async function executeAutofill(tabId: number) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "MATARAM_RUN_AUTOFILL" });
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js"]
      });
      await chrome.tabs.sendMessage(tabId, { type: "MATARAM_RUN_AUTOFILL" });
    } catch {
      // Restricted page or scripting disallowed
    }
  }
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "run-autofill") return;
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id) return;
  await executeAutofill(tab.id);
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "mataram-run",
    title: "Run Mataram Autofill",
    contexts: ["page", "editable"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "mataram-run" || !tab?.id) return;
  await executeAutofill(tab.id);
});
