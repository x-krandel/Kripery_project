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
  if (message?.type !== "GET_ACTIVE_IMAGES" && message?.type !== "GET_ACTIVE_ARTWORK_META") return false;

  chrome.tabs.query({ active: true, lastFocusedWindow: true }).then(async (tabs) => {
    const tab = tabs[0];
    if (!tab?.id) {
      sendResponse({ error: "Nie znaleziono aktywnej karty." });
      return;
    }

    try {
      if (message.type === "GET_ACTIVE_ARTWORK_META") {
        const meta = await sendToTab(tab.id, { type: "GET_ARTWORK_META" });
        sendResponse({ meta });
      } else {
        const images = await sendToTab(tab.id, { type: "SCAN_IMAGES" });
        sendResponse({ images: images ?? [] });
      }
    } catch {
      sendResponse({ images: [], error: "Nie można odczytać informacji z tej strony." });
    }
  });

  return true;
});

const pingPanel = () => chrome.runtime.sendMessage({ type: "PAGE_CHANGED" }).catch(() => {});
chrome.tabs.onActivated.addListener(pingPanel);
chrome.tabs.onUpdated.addListener((_id, info) => {
  if (info.status === "complete") pingPanel();
});