// Clean Copy — popup script

const status = document.getElementById("status");

function setStatus(msg, type) {
  status.textContent = msg;
  status.className = "status " + (type || "");
  if (type === "success") {
    setTimeout(() => window.close(), 800);
  }
}

async function copyArticle(format) {
  setStatus("Extracting...");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      setStatus("No active tab", "error");
      return;
    }

    const response = await chrome.tabs.sendMessage(tab.id, {
      action: "extract",
      format: format
    });

    if (response.error) {
      setStatus(response.error, "error");
      return;
    }

    await navigator.clipboard.writeText(response.content);
    setStatus(`Copied! (${response.title.slice(0, 30)}...)`, "success");
  } catch (err) {
    setStatus("Failed — try refreshing the page", "error");
    console.error("Clean Copy error:", err);
  }
}

document.getElementById("read-clean").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  chrome.tabs.sendMessage(tab.id, { action: "toggle-reader" });
  window.close();
});

document.getElementById("copy-md").addEventListener("click", () => copyArticle("markdown"));
document.getElementById("copy-text").addEventListener("click", () => copyArticle("text"));
document.getElementById("copy-html").addEventListener("click", () => copyArticle("html"));
