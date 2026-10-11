const elements = {
  connectionStatus: document.querySelector("#connection-status"),
  filename: document.querySelector("#filename"),
  imageSelect: document.querySelector("#image-select"),
  previewEmpty: document.querySelector("#preview-empty"),
  previewImage: document.querySelector("#preview-image"),
  result: document.querySelector("#result"),
  resultSection: document.querySelector(".result-section"),
  searchButton: document.querySelector("#search-button"),
  searchQuery: document.querySelector("#search-query"),
  authorQuery: document.querySelector("#author-query"),
  sourceLabel: document.querySelector("#source-label"),
  footer: document.querySelector("footer"),
};

let pageImages = [];
let pageMeta = null;
let selectedImage = null;
let requestNumber = 0;
let lastAutoLookupKey = "";
let manualQueryOverride = false;

function setStatus(message, state = "") {
  elements.connectionStatus.textContent = message;
  elements.footer.dataset.state = state;
}

function fileNameFromUrl(value = "") {
  try {
    return decodeURIComponent(new URL(value).pathname.split("/").filter(Boolean).pop() || "");
  } catch {
    return "";
  }
}

function imageTitle(image) {
  const context = image?.context || {};
  return context.caption || image?.alt || context.title || pageMeta?.title || fileNameFromUrl(image?.src) || "";
}

function imageAuthor(image) {
  return image?.context?.author || pageMeta?.author || "";
}

function populateImages(images) {
  pageImages = images;
  elements.imageSelect.replaceChildren(new Option("Wybierz obraz ze strony", ""));
  images.forEach((image, index) => {
    const label = imageTitle(image) || `Obraz ${index + 1}`;
    elements.imageSelect.add(new Option(label.slice(0, 120), String(index)));
  });
}

function showSelectedImage(image) {
  selectedImage = image || null;
  if (!image) {
    elements.previewImage.hidden = true;
    elements.previewEmpty.hidden = false;
    elements.filename.textContent = "Nie wybrano obrazu";
    return;
  }

  const title = imageTitle(image);
  elements.previewImage.src = image.src;
  elements.previewImage.alt = image.alt || title;
  elements.previewImage.hidden = false;
  elements.previewEmpty.hidden = true;
  elements.filename.textContent = [title, imageAuthor(image)].filter(Boolean).join(" · ") || fileNameFromUrl(image.src);
  elements.searchQuery.value = title;
  elements.authorQuery.value = imageAuthor(image);
  elements.searchButton.disabled = !elements.searchQuery.value.trim() && !elements.authorQuery.value.trim();
}

function renderWikiSection(label, entry) {
  if (!entry) return false;
  const section = document.createElement("section");
  section.className = "wiki-card";
  section.append(document.createElement("h3"));
  section.lastElementChild.textContent = label;
  section.append(document.createElement("p"));
  section.lastElementChild.textContent = entry.extract;
  const link = document.createElement("a");
  link.href = entry.url;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.textContent = `Czytaj więcej w Wikipedii (${entry.language.toUpperCase()})`;
  section.append(link);
  elements.result.append(section);
  return true;
}

function renderMuseums(records) {
  if (!records.length) return;
  const section = document.createElement("section");
  section.className = "museum-section";
  const heading = document.createElement("h3");
  heading.textContent = "Podobne dzieła w muzeach";
  section.append(heading);

  const list = document.createElement("div");
  list.className = "museum-list";
  records.forEach((record) => {
    const item = document.createElement("article");
    item.className = "museum-item";
    if (record.image) {
      const image = document.createElement("img");
      image.src = record.image;
      image.alt = "";
      image.loading = "lazy";
      image.addEventListener("error", () => image.remove(), { once: true });
      item.append(image);
    }
    const copy = document.createElement("div");
    const link = document.createElement("a");
    link.href = record.url;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = record.title;
    copy.append(link);
    const metadata = [record.artist, record.date, record.medium, record.source].filter(Boolean).join(" · ");
    if (metadata) {
      const meta = document.createElement("p");
      meta.textContent = metadata;
      copy.append(meta);
    }
    item.append(copy);
    list.append(item);
  });
  section.append(list);
  elements.result.append(section);
}

async function searchContext(title = elements.searchQuery.value.trim(), author = elements.authorQuery.value.trim()) {
  const normalizedTitle = title.trim();
  const normalizedAuthor = author.trim();
  if (!normalizedTitle && !normalizedAuthor) {
    setStatus("Na tej stronie nie udało się wykryć tytułu ani autora.", "error");
    return;
  }
  lastAutoLookupKey = `${pageMeta?.pageUrl || ""}|${selectedImage?.src || selectedImage?.name || ""}|${normalizedTitle}|${normalizedAuthor}`;

  const currentRequest = ++requestNumber;
  elements.resultSection.setAttribute("aria-busy", "true");
  elements.result.replaceChildren(Object.assign(document.createElement("p"), {
    className: "result-message",
    textContent: "Szukam krótkiego kontekstu w Wikipedii i kolekcjach muzealnych...",
  }));
  elements.sourceLabel.textContent = "WIKIPEDIA · MUZEA";
  setStatus("Wyszukuję informacje o dziele...");

  try {
    const result = await lookupArtwork({ title: normalizedTitle, author: normalizedAuthor });
    if (currentRequest !== requestNumber) return;
    elements.result.replaceChildren();

    const heading = document.createElement("header");
    heading.className = "artwork-profile";
    const eyebrow = document.createElement("p");
    eyebrow.className = "profile-kicker";
    eyebrow.textContent = "WYNIKI WYSZUKIWANIA";
    heading.append(eyebrow);
    const titleElement = document.createElement("h3");
    titleElement.className = "profile-title";
    titleElement.textContent = result.work?.title || normalizedTitle || normalizedAuthor;
    heading.append(titleElement);
    if (normalizedAuthor) {
      const authorElement = document.createElement("p");
      authorElement.className = "profile-author";
      authorElement.textContent = normalizedAuthor;
      heading.append(authorElement);
    }
    const pageFacts = [selectedImage?.context?.year || pageMeta?.year, selectedImage?.context?.technique || pageMeta?.technique, selectedImage?.context?.size || pageMeta?.size].filter(Boolean);
    if (pageFacts.length) {
      const facts = document.createElement("p");
      facts.className = "profile-details";
      facts.textContent = pageFacts.join(" · ");
      heading.append(facts);
    }
    elements.result.append(heading);

    const hasWork = renderWikiSection("O dziele", result.work);
    const hasArtist = renderWikiSection("O autorze", result.artist);
    renderMuseums(result.museumRecords);

    if (!hasWork && !hasArtist && !result.museumRecords.length) {
      const empty = document.createElement("p");
      empty.className = "result-message";
      empty.textContent = "Nie znaleziono krótkiego opisu. Spróbuj poprawić tytuł lub autora w sekcji korekty.";
      elements.result.append(empty);
    }
    setStatus("Gotowe. Sprawdź streszczenia i rekordy źródłowe.", "ok");
  } catch (error) {
    if (currentRequest !== requestNumber) return;
    elements.result.replaceChildren(Object.assign(document.createElement("p"), {
      className: "result-message",
      textContent: error.message || "Nie udało się wyszukać informacji.",
    }));
    setStatus("Wyszukiwanie nie powiodło się.", "error");
  } finally {
    if (currentRequest === requestNumber) {
      elements.resultSection.setAttribute("aria-busy", "false");
      elements.searchButton.disabled = !elements.searchQuery.value.trim() && !elements.authorQuery.value.trim();
    }
  }
}

function autoLookupSelectedImage(image) {
  const title = imageTitle(image);
  const author = imageAuthor(image);
  const key = `${pageMeta?.pageUrl || ""}|${image?.src || image?.name || ""}|${title}|${author}`;
  if ((!title && !author) || key === lastAutoLookupKey || (manualQueryOverride && selectedImage?.src === image?.src)) return false;
  lastAutoLookupKey = key;
  elements.searchQuery.value = title;
  elements.authorQuery.value = author;
  searchContext(title, author);
  return true;
}

async function scanPage() {
  setStatus("Skanuję stronę...");
  try {
    const [imageResponse, metaResponse] = await Promise.all([
      chrome.runtime.sendMessage({ type: "GET_ACTIVE_IMAGES" }),
      chrome.runtime.sendMessage({ type: "GET_ACTIVE_ARTWORK_META" }),
    ]);
    if (imageResponse?.error) throw new Error(imageResponse.error);

    const nextMeta = metaResponse?.meta || null;
    const pageChanged = pageMeta?.pageUrl && nextMeta?.pageUrl !== pageMeta.pageUrl;
    if (pageChanged) {
      selectedImage = null;
      manualQueryOverride = false;
      elements.imageSelect.value = "";
      elements.previewImage.hidden = true;
      elements.previewEmpty.hidden = false;
      elements.filename.textContent = "Nie wybrano obrazu";
      elements.result.replaceChildren(Object.assign(document.createElement("p"), {
        className: "result-placeholder",
        textContent: "Wybierz obraz z listy, aby zobaczyć informacje.",
      }));
    }
    pageMeta = nextMeta;
    populateImages(imageResponse?.images || []);

    if (!selectedImage && pageMeta?.title) {
      elements.searchQuery.value = pageMeta.title;
      elements.authorQuery.value = pageMeta.author || "";
    }

    if (!selectedImage && pageImages.length) {
      const bestImage = [...pageImages].sort((left, right) => {
        const scoreDifference = (right.context?.score || 0) - (left.context?.score || 0);
        if (scoreDifference) return scoreDifference;
        return right.width * right.height - left.width * left.height;
      })[0];
      const bestIndex = pageImages.indexOf(bestImage);
      elements.imageSelect.value = String(bestIndex);
      showSelectedImage(bestImage);
      if (!autoLookupSelectedImage(bestImage)) {
        setStatus(`Znaleziono ${pageImages.length} obrazów. Wyniki są aktualne.`, "ok");
      }
      return;
    }
    if (selectedImage && pageImages.some((image) => image.src === selectedImage.src)) {
      const currentImage = pageImages.find((image) => image.src === selectedImage.src);
      if (!autoLookupSelectedImage(currentImage)) {
        setStatus(`Znaleziono ${pageImages.length} obrazów. Wyniki są aktualne.`, "ok");
      }
      return;
    }
    setStatus(pageImages.length ? `Znaleziono ${pageImages.length} obrazów.` : "Nie znaleziono widocznych obrazów.", pageImages.length ? "ok" : "");
  } catch (error) {
    setStatus(error.message || "Nie można zeskanować tej strony.", "error");
  }
}

function selectImage(image) {
  selectedImage = image;
  manualQueryOverride = false;
  showSelectedImage(image);
  const title = imageTitle(image);
  const author = imageAuthor(image);
  lastAutoLookupKey = `${pageMeta?.pageUrl || ""}|${image?.src || image?.name || ""}|${title}|${author}`;
  elements.searchQuery.value = title;
  elements.authorQuery.value = author;
  searchContext(title, author);
}

elements.imageSelect.addEventListener("change", () => {
  const image = pageImages[Number(elements.imageSelect.value)];
  if (image) selectImage(image);
});

elements.searchQuery.addEventListener("input", () => {
  manualQueryOverride = true;
  elements.searchButton.disabled = !elements.searchQuery.value.trim() && !elements.authorQuery.value.trim();
});
elements.authorQuery.addEventListener("input", () => {
  manualQueryOverride = true;
  elements.searchButton.disabled = !elements.searchQuery.value.trim() && !elements.authorQuery.value.trim();
});
elements.searchButton.addEventListener("click", () => searchContext());
elements.searchQuery.addEventListener("keydown", (event) => {
  if (event.key === "Enter") searchContext();
});
elements.authorQuery.addEventListener("keydown", (event) => {
  if (event.key === "Enter") searchContext();
});
document.querySelector("#refresh-images").addEventListener("click", scanPage);

document.querySelector("#image-file").addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file || !file.type.startsWith("image/")) {
    if (file) setStatus("Wybierz plik obrazu.", "error");
    return;
  }
  try {
    const reader = new FileReader();
    const dataUrl = await new Promise((resolve, reject) => {
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Nie udało się odczytać pliku obrazu."));
      reader.readAsDataURL(file);
    });
    const uploadedImage = { name: file.name, alt: file.name, src: "", context: {} };
    selectedImage = uploadedImage;
    elements.previewImage.src = dataUrl;
    elements.previewImage.alt = file.name;
    elements.previewImage.hidden = false;
    elements.previewEmpty.hidden = true;
    elements.filename.textContent = file.name;
    elements.searchQuery.value = file.name.replace(/\.[^.]+$/, "");
    elements.authorQuery.value = "";
    selectedImage.context = {};
    const title = file.name.replace(/\.[^.]+$/, "");
    elements.searchQuery.value = title;
    elements.authorQuery.value = "";
    await searchContext(title, "");
  } catch (error) {
    setStatus(error.message, "error");
  }
});

let rescanTimer;
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== "PAGE_CHANGED") return;
  clearTimeout(rescanTimer);
  rescanTimer = setTimeout(scanPage, 400);
});

scanPage();
chrome.storage.local.remove("geminiApiKey");
