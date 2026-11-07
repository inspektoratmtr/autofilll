import { runAutofill } from "../engine/rules/runner";
import { captureCurrentForm } from "../engine/autofill/capture";

// Always register message listener so newly injected scripts immediately respond to commands
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "MATARAM_PING") {
    sendResponse({ ok: true });
    return false;
  }

  if (message?.type === "MATARAM_RUN_AUTOFILL") {
    runAutofill(message.profileId)
      .then((results) => {
        sendResponse({ ok: true, results });
      })
      .catch((error) => {
        sendResponse({ ok: false, error: String(error) });
      });
    return true; // Keep channel open for async response
  }

  if (message?.type === "MATARAM_CAPTURE_FORM") {
    try {
      const rules = captureCurrentForm(message.profileId);
      sendResponse({ ok: true, rules });
    } catch (error) {
      sendResponse({ ok: false, error: String(error) });
    }
    return false;
  }
});

// Auto-fill recorded values on initial page load or reload
runAutofill().catch(() => {});
setTimeout(() => {
  runAutofill().catch(() => {});
}, 600);
