(() => {
if (window.__kriperyLoaded) return;
window.__kriperyLoaded = true;

function getPageImages() {
  const seen = new Set();
  return Array.from(document.images)
    .filter((image) => image.complete && image.naturalWidth >= 80 && image.naturalHeight >= 80)
    .map((image) => {
      const rect = image.getBoundingClientRect();
      return {
        src: image.currentSrc || image.src,
        alt: image.alt || image.title || "",
        width: image.naturalWidth,
        height: image.naturalHeight,
        visible: rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < innerHeight && rect.left < innerWidth,
      };
    })
    .filter((image) => image.visible)
    .filter((image) => image.src && !seen.has(image.src) && seen.add(image.src))
    .slice(0, 60);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "SCAN_IMAGES") {
    sendResponse(getPageImages());
  } else if (message?.type === "GET_IMAGE_RECT") {
    const image = Array.from(document.images).find((candidate) => (candidate.currentSrc || candidate.src) === message.src);
    if (!image) {
      sendResponse(null);
      return;
    }
    const rect = image.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0 || rect.bottom <= 0 || rect.right <= 0 || rect.top >= innerHeight || rect.left >= innerWidth) {
      sendResponse(null);
      return;
    }
    sendResponse({
      x: Math.max(0, rect.left),
      y: Math.max(0, rect.top),
      width: Math.min(rect.right, innerWidth) - Math.max(rect.left, 0),
      height: Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0),
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
    });
  }
});

document.addEventListener("click", (event) => {
  const image = event.target instanceof Element ? event.target.closest("img") : null;
  if (!image || image.naturalWidth < 80 || image.naturalHeight < 80) return;

  chrome.storage.local.set({
    selectedImage: {
      src: image.currentSrc || image.src,
      alt: image.alt || image.title || "",
      width: image.naturalWidth,
      height: image.naturalHeight,
    },
  });
}, true);

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