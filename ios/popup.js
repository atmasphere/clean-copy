// Clean Copy — popup script (Safari/iOS compatible)
// Debug version — shows errors visibly in the status area

const status = document.getElementById("status");

function setStatus(msg, type) {
  status.textContent = msg;
  status.className = "status " + (type || "");
  if (type === "success") {
    setTimeout(() => window.close(), 1200);
  }
}

// Show any uncaught errors
window.onerror = function(msg, src, line) {
  setStatus("JS error: " + msg + " (line " + line + ")", "error");
};

// iOS-safe clipboard helper
function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).catch(() => execCommandCopy(text));
  }
  return execCommandCopy(text);
}

function execCommandCopy(text) {
  return new Promise((resolve, reject) => {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.cssText =
      "position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:none;outline:none;opacity:0.01;";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    try {
      document.execCommand("copy");
      resolve();
    } catch (err) {
      reject(err);
    } finally {
      textarea.remove();
    }
  });
}

// Try to send a message to the content script.
// If it fails (content script not injected), inject it first and retry.
async function sendToContentScript(tab, message) {
  setStatus("Sending to tab " + tab.id + "...");
  try {
    const response = await chrome.tabs.sendMessage(tab.id, message);
    return response;
  } catch (err) {
    setStatus("Injecting scripts...");
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["lib/Readability.js", "lib/turndown.js", "content.js"]
      });
      await new Promise(r => setTimeout(r, 500));
      setStatus("Retrying...");
      return await chrome.tabs.sendMessage(tab.id, message);
    } catch (injectErr) {
      throw new Error("Inject failed: " + injectErr.message);
    }
  }
}

async function copyArticle(format) {
  setStatus("Extracting...");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      setStatus("No active tab found", "error");
      return;
    }
    setStatus("Tab: " + tab.url);

    const response = await sendToContentScript(tab, {
      action: "extract",
      format: format
    });

    if (!response || response.error) {
      setStatus(response ? response.error : "No response from page", "error");
      return;
    }

    await copyToClipboard(response.content);
    setStatus("Copied! (" + response.title.slice(0, 30) + "...)", "success");
  } catch (err) {
    setStatus("Error: " + err.message, "error");
    console.error("Clean Copy error:", err);
  }
}

document.getElementById("read-clean").addEventListener("click", async () => {
  setStatus("Read Clean tapped...");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      setStatus("No active tab", "error");
      return;
    }
    setStatus("Tab: " + tab.url);
    await sendToContentScript(tab, { action: "toggle-reader" });
    setStatus("Panel opened", "success");
  } catch (err) {
    setStatus("Error: " + err.message, "error");
  }
});

document.getElementById("copy-md").addEventListener("click", () => copyArticle("markdown"));
document.getElementById("copy-text").addEventListener("click", () => copyArticle("text"));
document.getElementById("copy-html").addEventListener("click", () => copyArticle("html"));

// Confirm script loaded
setStatus("Ready");
