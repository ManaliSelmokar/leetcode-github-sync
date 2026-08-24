const fields = ["token", "owner", "repo", "branch", "basePath"];
const defaults = { owner: "", repo: "", branch: "main", basePath: "solutions" };
const settingsPanel = document.getElementById("settingsPanel");

document.getElementById("settingsToggle").addEventListener("click", () => {
  settingsPanel.hidden = !settingsPanel.hidden;
});

chrome.storage.local.get({ ...defaults, token: "", lastSync: null }, (settings) => {
  for (const field of fields) {
    document.getElementById(field).value = settings[field] || "";
  }
  document.getElementById("status").textContent = settings.token ? "Token saved. Ready to sync." : "Add a GitHub token in the extension settings first.";
  document.getElementById("destination").textContent = settings.owner && settings.repo ? `${settings.owner}/${settings.repo} · ${settings.branch}` : "Repository not configured";
  if (settings.lastSync) {
    const lastSync = document.getElementById("lastSync");
    lastSync.textContent = settings.lastSync.message;
    lastSync.classList.remove("empty");
    lastSync.classList.toggle("error", !settings.lastSync.ok);
  }
});

document.getElementById("save").addEventListener("click", async () => {
  const settings = Object.fromEntries(fields.map((field) => [field, document.getElementById(field).value.trim()]));
  const status = document.getElementById("status");
  if (!settings.token) {
    status.textContent = "Paste a GitHub token before saving.";
    status.style.color = "#a73e23";
    return;
  }
  try {
    await new Promise((resolve, reject) => chrome.storage.local.set(settings, () => {
      const error = chrome.runtime.lastError;
      error ? reject(new Error(error.message)) : resolve();
    }));
    setStatus("Token saved. Ready to sync.", "success");
    settingsPanel.hidden = true;
  } catch (error) {
    setStatus(`Could not save settings: ${error.message}`, "error");
  }
});

document.getElementById("syncCurrent").addEventListener("click", async () => {
  const status = document.getElementById("status");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url?.startsWith("https://leetcode.com/problems/")) {
      throw new Error("Open a LeetCode problem first.");
    }

    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const editor = document.querySelector('textarea[aria-label="Code editor"]');
        const heading = document.querySelector("h1");
        const languageButton = [...document.querySelectorAll("button")].find((button) => /^(C\+\+|Java|Python|Python3|JavaScript|TypeScript|Go|Rust|C#|Kotlin|Swift|Ruby|PHP)$/i.test(button.textContent.trim()));
        return {
          title: heading?.textContent?.replace(/^\d+\.\s*/, "").trim() || location.pathname.split("/")[2],
          language: languageButton?.textContent.trim() || "text",
          code: editor?.value?.trim() || ""
        };
      }
    });

    if (!result.result.code) {
      throw new Error("The code editor is empty or not available. Refresh LeetCode and try again.");
    }

    setStatus("Uploading solution...", "working");
    const response = await chrome.runtime.sendMessage({
      type: "accepted-submission",
      submission: { ...result.result, url: tab.url }
    });
    if (!response?.ok) {
      throw new Error(response?.error || "The upload failed.");
    }
    setStatus(`Saved ${response.result.path}`, "success");
  } catch (error) {
    setStatus(error.message, "error");
  }
});

function setStatus(message, state = "") {
  const status = document.getElementById("status");
  const statusDot = document.querySelector(".status-dot");
  status.textContent = message;
  status.className = `status ${state}`;
  statusDot.className = `status-dot ${state}`;
}
