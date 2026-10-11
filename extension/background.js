chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

async function sendToTab(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
    return chrome.tabs.sendMessage(tabId, message);
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "GET_ACTIVE_IMAGES") return false;

  chrome.tabs.query({ active: true, lastFocusedWindow: true }).then(async (tabs) => {
    const tab = tabs[0];
    if (!tab?.id) {
      sendResponse({ images: [], error: "Nie znaleziono aktywnej karty." });
      return;
    }

    try {
      const images = await sendToTab(tab.id, { type: "SCAN_IMAGES" });
      sendResponse({ images: images ?? [] });
    } catch {
      sendResponse({ images: [], error: "Ta strona nie udostępnia obrazów do odczytu." });
    }
  });

  return true;
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "CAPTURE_SELECTED_IMAGE") return false;

  chrome.tabs.query({ active: true, lastFocusedWindow: true }).then(async (tabs) => {
    const tab = tabs[0];
    if (!tab?.id || !tab.windowId) {
      sendResponse({ error: "Nie znaleziono aktywnej karty." });
      return;
    }

    try {
      const rect = await sendToTab(tab.id, {
        type: "GET_IMAGE_RECT",
        src: message.src,
      });
      if (!rect) {
        sendResponse({ error: "Obraz nie jest widoczny. Przewiń go na ekran i spróbuj ponownie." });
        return;
      }

      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
        format: "jpeg",
        quality: 85,
      });
      sendResponse({ dataUrl, rect });
    } catch {
      sendResponse({ error: "Chrome nie mógł przechwycić obrazu z tej karty." });
    }
  });

  return true;
});

const pingPanel = () => chrome.runtime.sendMessage({ type: "PAGE_CHANGED" }).catch(() => {});
chrome.tabs.onActivated.addListener(pingPanel);
chrome.tabs.onUpdated.addListener((_id, info) => {
  if (info.status === "complete") pingPanel();
});