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
    document.getElementById("destination").textContent = `${settings.owner}/${settings.repo} · ${settings.branch}`;
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

    setStatus("Uploading solution...", "working");
    const response = await sendSyncRequest(tab.id);
    if (!response?.ok) {
      throw new Error(response?.error || "The upload failed.");
    }
    setStatus(`Saved ${response.result.path}`, "success");
  } catch (error) {
    setStatus(error.message, "error");
  }
});

async function sendSyncRequest(tabId) {
  try {
    return await chrome.tabs.sendMessage(tabId, { type: "sync-current" });
  } catch (error) {
    if (!/Receiving end does not exist|Could not establish connection/i.test(error.message)) {
      throw error;
    }

    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
    throw new Error("Extension connected. Refresh this LeetCode page, submit again, and wait for Accepted.");
  }
}

function setStatus(message, state = "") {
  const status = document.getElementById("status");
  const statusDot = document.querySelector(".status-dot");
  status.textContent = message;
  status.className = `status ${state}`;
  statusDot.className = `status-dot ${state}`;
}
