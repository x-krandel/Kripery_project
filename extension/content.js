(() => {
if (window.__kriperyLoaded) return;
window.__kriperyLoaded = true;

function getPageImages() {
  const seen = new Set();
  return Array.from(document.images)
    .map((image) => {
      const rect = image.getBoundingClientRect();
      const source = image.currentSrc
        || image.getAttribute("src")
        || image.getAttribute("data-src")
        || image.getAttribute("data-original")
        || image.getAttribute("data-lazy-src")
        || image.getAttribute("srcset")?.split(",")[0]?.trim().split(/\s+/)[0]
        || image.getAttribute("data-srcset")?.split(",")[0]?.trim().split(/\s+/)[0]
        || image.src
        || "";
      return {
        src: source,
        alt: usefulArtworkLabel(image.alt || image.title || image.getAttribute("aria-label") || ""),
        width: image.naturalWidth || Math.round(rect.width),
        height: image.naturalHeight || Math.round(rect.height),
        visible: rect.width >= 80 && rect.height >= 80,
        context: getImageContext(image),
      };
    })
    .filter((image) => image.visible && /^https?:|^blob:|^data:image\//i.test(image.src))
    .filter((image) => !seen.has(image.src) && seen.add(image.src))
    .slice(0, 60);
}

function cleanText(value) {
  return (value || "").replace(/[\u00a0\s]+/g, " ").trim();
}

function usefulArtworkLabel(value) {
  const text = cleanText(value);
  if (!text || /^(image|photo|picture|artwork|untitled|thumbnail)(\s*[-#:]?\s*\d+)?$/i.test(text)) return "";
  return text;
}

function getStructuredArtworkMeta() {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const script of scripts) {
    try {
      const parsed = JSON.parse(script.textContent || "null");
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      const stack = [...nodes];
      while (stack.length) {
        const node = stack.pop();
        if (!node || typeof node !== "object") continue;
        if (Array.isArray(node)) {
          stack.push(...node);
          continue;
        }
        if (node["@graph"]) stack.push(...(Array.isArray(node["@graph"]) ? node["@graph"] : [node["@graph"]]));
        const type = Array.isArray(node["@type"]) ? node["@type"].join(" ") : node["@type"] || "";
        if (/VisualArtwork|Painting|Sculpture|CreativeWork|Product/i.test(type) && (node.name || node.headline)) {
          const creator = Array.isArray(node.creator) ? node.creator[0] : node.creator || node.author;
          return {
            title: cleanText(node.name || node.headline),
            author: cleanText(typeof creator === "string" ? creator : creator?.name || ""),
            year: cleanText(node.dateCreated || node.datePublished || ""),
            technique: cleanText(node.artMedium || node.material || ""),
            description: cleanText(node.description || ""),
          };
        }
        for (const value of Object.values(node)) {
          if (value && typeof value === "object") stack.push(value);
        }
      }
    } catch {
      // Ignore malformed page metadata and continue with visible text.
    }
  }
  return null;
}

function getArtworkMeta() {
  const structured = getStructuredArtworkMeta();
  const titleElement = document.querySelector("[data-artwork-title], [itemprop='name'], h1")
    || document.querySelector('meta[property="og:title"]');
  const title = cleanText(titleElement?.getAttribute("data-artwork-title")
    || titleElement?.getAttribute("content")
    || titleElement?.textContent
    || structured?.title
    || document.title);
  const metaAuthor = document.querySelector('[data-artwork-author], [itemprop="author"], [rel="author"], meta[name="author"]');
  let author = cleanText(metaAuthor?.getAttribute("data-artwork-author")
    || metaAuthor?.getAttribute("content")
    || metaAuthor?.textContent
    || structured?.author);
  if (!author) {
    const authorText = document.querySelector("h1")?.parentElement?.textContent || "";
    const match = authorText.match(/(?:by|par|autor(?:stwa)?|artysta)\s+([^|·\n,]{2,100})/i);
    if (match) author = cleanText(match[1]);
  }
  const subtitle = cleanText(document.querySelector("h1")?.nextElementSibling?.textContent || "");
  const [first = "", technique = "", size = ""] = subtitle.split("·").map(cleanText);
  const [subtitleAuthor = "", subtitleYear = ""] = first.split(",").map(cleanText);
  author ||= subtitleAuthor;
  const year = cleanText(structured?.year || subtitleYear || document.querySelector("[itemprop='dateCreated']")?.textContent || "");

  return {
    title,
    author,
    year,
    technique: cleanText(structured?.technique || technique),
    size,
    description: structured?.description || "",
    pageUrl: location.href,
  };
}

function getImageContext(image) {
  const figure = image.closest("figure, [role='figure'], [itemtype*='VisualArtwork']");
  const captionElement = figure?.querySelector("figcaption, [itemprop='caption'], [data-caption]");
  const caption = cleanText(captionElement?.getAttribute("data-caption") || captionElement?.textContent || "");
  const imageLink = image.closest("a");
  const label = cleanText(image.getAttribute("aria-label") || image.getAttribute("title") || imageLink?.getAttribute("aria-label") || imageLink?.getAttribute("title") || "");
  const artworkCard = image.closest("article, li, [class*='artwork'], [class*='painting'], [class*='object'], [class*='card']");
  const cardHeading = artworkCard?.querySelector("h1, h2, h3, h4, [itemprop='name'], [data-artwork-title]");
  let nearby = "";
  let parent = image.parentElement;
  for (let depth = 0; parent && depth < 4; depth += 1, parent = parent.parentElement) {
    const text = cleanText(parent.textContent);
    if (text.length >= 12 && text.length <= 360) {
      nearby = text;
      break;
    }
  }
  const pageMeta = getArtworkMeta();
  const imageTitle = usefulArtworkLabel(image.getAttribute("data-artwork-title") || image.getAttribute("data-title") || cardHeading?.getAttribute("data-artwork-title") || cardHeading?.textContent || label);
  const authorElement = figure?.querySelector("[data-artwork-author], [data-artist], [itemprop='creator'], [itemprop='author'], [class*='artist'], [class*='author']")
    || image.closest("article, li, [class*='artwork'], [class*='painting']")?.querySelector("[data-artwork-author], [data-artist], [itemprop='creator'], [itemprop='author'], [class*='artist'], [class*='author']");
  const authorText = cleanText(authorElement?.getAttribute("data-artwork-author") || authorElement?.getAttribute("data-artist") || authorElement?.textContent || "");
  const nearbyAuthor = nearby.match(/(?:artist|author|artysta|autor)\s*[:·-]\s*([^|·\n,]{2,100})|(?:by|par)\s+([^|·\n,]{2,100})/i);
  const imageAuthor = cleanText(image.getAttribute("data-artwork-author") || image.getAttribute("data-artist") || authorText || nearbyAuthor?.[1] || nearbyAuthor?.[2] || "");
  const pathName = cleanText((image.currentSrc || image.getAttribute("src") || image.getAttribute("data-src") || "").split("/").pop()?.split(/[?#]/)[0]?.replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[-_]+/g, " "));
  const title = caption || usefulArtworkLabel(image.alt) || imageTitle || pathName || pageMeta.title || "";
  const author = imageAuthor || pageMeta.author || "";
  return {
    title,
    author,
    year: pageMeta.year,
    technique: pageMeta.technique,
    size: pageMeta.size,
    caption: (caption || label).slice(0, 300),
    nearby: nearby.slice(0, 300),
    score: (caption ? 8 : 0) + (usefulArtworkLabel(image.alt) ? 6 : 0) + (imageTitle ? 5 : 0) + (author ? 4 : 0) + (nearby ? 2 : 0) + (image.naturalWidth > 300 ? 1 : 0),
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "SCAN_IMAGES") {
    sendResponse(getPageImages());
  } else if (message?.type === "GET_ARTWORK_META") {
    sendResponse(getArtworkMeta());
  }
});

let timer;
const notify = () => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    chrome.runtime.sendMessage({ type: "PAGE_CHANGED" }).catch(() => {});
  }, 400);
};
window.addEventListener("load", notify);
new MutationObserver(notify).observe(document.documentElement, {
  childList: true,
  subtree: true,
});
notify();
})();