// Clean Copy — background service worker
// Handles keyboard shortcuts and archive.today fetches

// ── Archive fetch ──────────────────────────────────────────────
// Content scripts can't do cross-origin fetches, so we proxy here.
// archive.today uses several mirror domains; try them in order.

const ARCHIVE_MIRRORS = [
  "https://archive.today",
  "https://archive.ph",
  "https://archive.is"
];

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fetch-archive") {
    fetchArchive(request.url).then(sendResponse);
    return true; // keep channel open for async
  }
});

async function fetchArchive(originalUrl) {
  for (const mirror of ARCHIVE_MIRRORS) {
    const archiveUrl = `${mirror}/newest/${originalUrl}`;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const resp = await fetch(archiveUrl, {
        redirect: "follow",
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!resp.ok) continue;

      const html = await resp.text();

      // Check for CAPTCHA or block page
      if (html.includes("Refresh the page") && html.includes("challenge")) {
        continue;
      }

      // archive.today wraps the original page — check we got real content
      if (html.length < 1000) continue;

      return { ok: true, html, finalUrl: resp.url };
    } catch (err) {
      // Timeout or network error — try next mirror
      continue;
    }
  }

  return { ok: false, error: "No archived version found. The page may not have been saved to archive.today yet." };
}

// ── Keyboard shortcuts ─────────────────────────────────────────

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "toggle-reader") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;
    try {
      await chrome.tabs.sendMessage(tab.id, { action: "toggle-reader" });
    } catch (err) {
      console.error("Clean Copy toggle-reader failed:", err);
    }
    return;
  }

  if (command === "copy-markdown") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    try {
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: "extract",
        format: "markdown"
      });

      if (response && response.content) {
        // Use offscreen document to write to clipboard from service worker
        await copyToClipboardViaTab(tab.id, response.content);
      }
    } catch (err) {
      console.error("Clean Copy extraction failed:", err);
    }
  }
});

async function copyToClipboardViaTab(tabId, text) {
  // Inject a small script to write to clipboard from the tab context
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (textToCopy) => {
      navigator.clipboard.writeText(textToCopy).then(() => {
        // Brief visual confirmation
        const toast = document.createElement("div");
        toast.textContent = "Copied clean article!";
        toast.style.cssText =
          "position:fixed;top:20px;right:20px;z-index:999999;padding:12px 20px;" +
          "background:#1a1a2e;color:#fff;border-radius:8px;font:14px/1.4 system-ui;" +
          "box-shadow:0 4px 12px rgba(0,0,0,.3);transition:opacity .3s";
        document.body.appendChild(toast);
        setTimeout(() => {
          toast.style.opacity = "0";
          setTimeout(() => toast.remove(), 300);
        }, 1500);
      });
    },
    args: [text]
  });
}
