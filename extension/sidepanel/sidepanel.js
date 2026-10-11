const elements = {
  connectionStatus: document.querySelector("#connection-status"),
  filename: document.querySelector("#filename"),
  imageSelect: document.querySelector("#image-select"),
  previewEmpty: document.querySelector("#preview-empty"),
  previewImage: document.querySelector("#preview-image"),
  result: document.querySelector("#result"),
  resultSection: document.querySelector(".result-section"),
  searchButton: document.querySelector("#search-button"),
  sourceLabel: document.querySelector("#source-label"),
  footer: document.querySelector("footer"),
};

let selectedImage = null;
let pageImages = [];
let selectedImageData = null;
const GEMINI_MODEL = "gemini-3.8-flash";

function setStatus(message, state = "") {
  elements.connectionStatus.textContent = message;
  elements.footer.dataset.state = state;
}

function fileNameFromUrl(value) {
  try {
    const path = new URL(value).pathname;
    return decodeURIComponent(path.split("/").filter(Boolean).pop() || "Obraz bez nazwy");
  } catch {
    return "Obraz bez nazwy";
  }
}

function setSelectedImage(image, imageData = null) {
  selectedImage = image || null;
  selectedImageData = imageData;
  if (!selectedImage) {
    elements.previewImage.hidden = true;
    elements.previewEmpty.hidden = false;
    elements.filename.textContent = "Nie wybrano obrazu";
    elements.searchButton.disabled = true;
    return;
  }

  const name = selectedImage.name || fileNameFromUrl(selectedImage.src || "");
  elements.previewImage.src = imageData || selectedImage.previewUrl || selectedImage.src;
  elements.previewImage.alt = selectedImage.alt || name;
  elements.previewImage.hidden = false;
  elements.previewEmpty.hidden = true;
  elements.filename.textContent = selectedImage.alt ? `${name} · ${selectedImage.alt}` : name;
  elements.searchButton.disabled = false;
}

function populateImageOptions(images) {
  pageImages = images;
  const currentSrc = selectedImage?.src;
  elements.imageSelect.replaceChildren(new Option("Wybierz obraz lub kliknij go na stronie", ""));
  images.forEach((image, index) => {
    const label = image.alt || fileNameFromUrl(image.src);
    elements.imageSelect.add(new Option(label, String(index)));
  });
  const currentIndex = images.findIndex((image) => image.src === currentSrc);
  if (currentIndex >= 0) elements.imageSelect.value = String(currentIndex);
}

async function scanPage() {
  setStatus("Skanuję obrazy na stronie...");
  try {
    const response = await chrome.runtime.sendMessage({ type: "GET_ACTIVE_IMAGES" });
    const images = response?.images || [];
    populateImageOptions(images);
    if (response?.error) {
      setStatus(response.error, "error");
      return;
    }
    const stillThere = images.some((image) => image.src === selectedImage?.src);
    if (!selectedImageData && !stillThere && images.length) {
      const biggest = [...images].sort((left, right) => right.width * right.height - left.width * left.height)[0];
      setSelectedImage(biggest);
      elements.imageSelect.value = String(images.indexOf(biggest));
    }
    setStatus(`Znaleziono obrazów: ${images.length}`, "ok");
  } catch {
    setStatus("Nie można odczytać obrazów z tej strony.", "error");
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Nie udało się odczytać wybranego obrazu."));
    reader.readAsDataURL(file);
  });
}

function parseDataUrl(dataUrl) {
  const [header, data] = dataUrl.split(",", 2);
  const mimeType = header.match(/^data:(.*?);base64$/)?.[1];
  if (!mimeType || !data) throw new Error("Nieprawidłowy format obrazu.");
  return { mimeType, data };
}

async function captureSelectedImage() {
  if (selectedImageData) return selectedImageData;
  if (!selectedImage?.src) throw new Error("Wybierz obraz ze strony lub plik z komputera.");

  const capture = await chrome.runtime.sendMessage({
    type: "CAPTURE_SELECTED_IMAGE",
    src: selectedImage.src,
  });
  if (capture?.error) throw new Error(capture.error);

  const screenshot = await createImageBitmap(await (await fetch(capture.dataUrl)).blob());
  const rect = capture.rect;
  const scaleX = screenshot.width / rect.viewportWidth;
  const scaleY = screenshot.height / rect.viewportHeight;
  const cropX = Math.round(rect.x * scaleX);
  const cropY = Math.round(rect.y * scaleY);
  const cropWidth = Math.max(1, Math.min(screenshot.width - cropX, Math.round(rect.width * scaleX)));
  const cropHeight = Math.max(1, Math.min(screenshot.height - cropY, Math.round(rect.height * scaleY)));
  const resizeScale = Math.min(1, 1280 / Math.max(cropWidth, cropHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(cropWidth * resizeScale));
  canvas.height = Math.max(1, Math.round(cropHeight * resizeScale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Nie udało się przygotować obrazu do analizy.");
  context.drawImage(screenshot, cropX, cropY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
  screenshot.close();
  return canvas.toDataURL("image/jpeg", 0.88);
}

function textElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

function addFacts(container, facts) {
  const list = document.createElement("dl");
  list.className = "fact-list";
  facts.forEach(([label, value]) => {
    if (!value) return;
    const item = document.createElement("div");
    item.className = "fact";
    item.append(textElement("dt", "", label), textElement("dd", "", value));
    list.append(item);
  });
  if (list.childElementCount) container.append(list);
}

function renderGeminiResult(result, citations) {
  elements.result.replaceChildren();
  elements.sourceLabel.textContent = "GEMINI FLASH · GOOGLE SEARCH";
  const paragraphs = result.trim().split(/\n\s*\n/).filter(Boolean);
  const copy = document.createElement("div");
  copy.className = "ai-copy";
  paragraphs.forEach((paragraph) => copy.append(textElement("p", "", paragraph.trim())));
  elements.result.append(copy);

  const sources = citations
    .filter((source) => source?.url && source?.title)
    .filter((source, index, all) => all.findIndex((candidate) => candidate.url === source.url) === index)
    .slice(0, 6);
  if (sources.length) {
    const section = document.createElement("section");
    section.className = "sources";
    section.append(textElement("h3", "", "Źródła do dalszego odkrywania"));
    const list = document.createElement("ol");
    sources.forEach((source) => {
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = source.url;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = source.title;
      item.append(link);
      list.append(item);
    });
    section.append(list);
    elements.result.append(section);
  } else {
    elements.result.append(textElement("p", "match-note", "Google Search nie zwrócił linków źródłowych dla tej odpowiedzi."));
  }
}

async function searchArtwork() {
  if (!selectedImage) return;
  elements.resultSection.setAttribute("aria-busy", "true");
  elements.result.replaceChildren(textElement("p", "result-message", "Przyglądam się obrazowi i szukam wiarygodnych źródeł..."));
  elements.sourceLabel.textContent = "ANALIZA OBRAZU";
  setStatus("Gemini analizuje obraz i szuka źródeł...");

  try {
    const apiKey = GEMINI_API_KEY;
    if (!apiKey || apiKey === "WKLEJ_TUTAJ_NOWY_KLUCZ") {
      throw new Error("Dodaj nowy klucz Gemini do extension/config.js, a następnie przeładuj rozszerzenie.");
    }
    const imageDataUrl = await captureSelectedImage();
    const { mimeType, data } = parseDataUrl(imageDataUrl);
    const imageContext = selectedImage.alt ? `Tekst alternatywny obrazu: ${selectedImage.alt}.` : "";
    const fileContext = selectedImage.name || selectedImage.src ? `Nazwa pliku lub obrazu: ${selectedImage.name || fileNameFromUrl(selectedImage.src)}.` : "";
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        model: GEMINI_MODEL,
        store: false,
        input: [
          {
            type: "text",
            text: `Jesteś przewodnikiem po sztuce dla ciekawego odbiorcy. Przeanalizuj załączony obraz, nie samą nazwę pliku. ${fileContext} ${imageContext}\n\nPo polsku, przystępnie i konkretnie: (1) opisz widoczne motywy i nastrój; (2) jeśli to możliwe, zaproponuj identyfikację dzieła lub artysty i wyjaśnij, co na obrazie jest wskazówką; (3) wyszukaj wiarygodne informacje o autorze, epoce i kontekście historycznym; (4) zakończ krótką, ciekawą historią albo pytaniem zachęcającym do dalszego poznawania dzieła. Użyj wyszukiwarki Google do weryfikacji faktów. Wyraźnie odróżniaj obserwacje od potwierdzonych informacji, nie zgaduj identyfikacji, jeśli nie masz pewności. Odpowiedź ma mieć krótkie akapity, nie więcej niż około 180 słów. Nie twórz listy źródeł w tekście, linki pokaże osobna sekcja.`,
          },
          { type: "image", mime_type: mimeType, data },
        ],
        tools: [{ type: "google_search" }],
      }),
    });
    const body = await response.json();
    if (!response.ok) {
      const message = body.error?.message || `Gemini zwrócił błąd ${response.status}.`;
      throw new Error(message);
    }
    const outputBlocks = body.steps
      ?.filter((step) => step.type === "model_output")
      .flatMap((step) => step.content || []) || [];
    const answer = outputBlocks
      .filter((block) => block.type === "text")
      .map((block) => block.text || "")
      .join("\n")
      .trim() || body.output_text?.trim();
    if (!answer) throw new Error("Gemini nie zwrócił opisu. Spróbuj z innym obrazem.");
    const citations = outputBlocks.flatMap((block) => block.annotations || [])
      .filter((annotation) => annotation.type === "url_citation");
    renderGeminiResult(answer, citations);
    setStatus("Analiza obrazu gotowa.", "ok");
  } catch (error) {
    elements.sourceLabel.textContent = "NIE UDAŁO SIĘ PRZEPROWADZIĆ ANALIZY";
    elements.result.replaceChildren(textElement("p", "result-message", error.message));
    setStatus("Analiza nie powiodła się.", "error");
  } finally {
    elements.resultSection.setAttribute("aria-busy", "false");
  }
}

elements.imageSelect.addEventListener("change", () => {
  if (!elements.imageSelect.value) return;
  const image = pageImages[Number(elements.imageSelect.value)];
  if (!image) return;
  setSelectedImage(image);
  chrome.storage.local.set({ selectedImage: image });
});

document.querySelector("#image-file").addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    setStatus("Wybierz plik obrazu.", "error");
    return;
  }
  try {
    const dataUrl = await fileToDataUrl(file);
    setSelectedImage({ name: file.name, alt: file.name }, dataUrl);
    elements.imageSelect.value = "";
    setStatus("Wybrano obraz z urządzenia.", "ok");
  } catch (error) {
    setStatus(error.message, "error");
  }
});

document.querySelector("#refresh-images").addEventListener("click", scanPage);
elements.searchButton.addEventListener("click", searchArtwork);
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes.selectedImage?.newValue) {
    setSelectedImage(changes.selectedImage.newValue);
  }
});

let rescanTimer;
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== "PAGE_CHANGED") return;
  clearTimeout(rescanTimer);
  rescanTimer = setTimeout(scanPage, 300);
});

async function initialize() {
  const stored = await chrome.storage.local.get("selectedImage");
  setSelectedImage(stored.selectedImage);
  await scanPage();
}

initialize();