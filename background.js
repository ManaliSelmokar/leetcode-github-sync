const DEFAULTS = {
  owner: "",
  repo: "",
  branch: "main",
  basePath: "solutions"
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "sync-error") {
    chrome.storage.local.set({ lastSync: { ok: false, message: message.error, at: Date.now() } });
    notify("Sync failed", message.error);
    return undefined;
  }
  if (message.type !== "accepted-submission") {
    return undefined;
  }

  saveSubmission(message.submission)
    .then((result) => {
      chrome.storage.local.set({ lastSync: { ok: true, message: `Saved ${result.path}`, url: result.url, at: Date.now() } });
      notify("Solution added", `Added "${message.submission.title}" to "${result.repository}"`);
      sendResponse({ ok: true, result });
    })
    .catch((error) => {
      chrome.storage.local.set({ lastSync: { ok: false, message: error.message, at: Date.now() } });
      notify("Sync failed", error.message);
      sendResponse({ ok: false, error: error.message });
    });

  return true;
});

function notify(title, message) {
  const notificationId = `leetcode-github-sync-${Date.now()}`;
  chrome.notifications.create(notificationId, {
    type: "basic",
    iconUrl: chrome.runtime.getURL("icon.png"),
    title,
    message
  }, () => {
    chrome.action.setBadgeText({ text: "✓" });
    chrome.action.setBadgeBackgroundColor({ color: "#28734b" });
    void chrome.runtime.lastError;
  });
}

async function saveSubmission(submission) {
  const storedSettings = await new Promise((resolve, reject) => chrome.storage.local.get({ ...DEFAULTS, token: "" }, (settings) => {
    const error = chrome.runtime.lastError;
    error ? reject(new Error(error.message)) : resolve(settings);
  }));
  const settings = { ...DEFAULTS, ...storedSettings };
  if (!settings.token) {
    throw new Error("Add a GitHub token in the extension settings first.");
  }

  if (!submission.code) {
    throw new Error("The accepted code could not be read from this LeetCode page.");
  }

  const extension = languageExtension(submission.language);
  const slug = slugify(submission.title || "leetcode-solution");
  const path = `${settings.basePath}/${slug}/solution.${extension}`;
  const apiUrl = `https://api.github.com/repos/${encodeURIComponent(settings.owner)}/${encodeURIComponent(settings.repo)}/contents/${path}`;
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${settings.token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json"
  };

  const existingResponse = await fetch(`${apiUrl}?ref=${encodeURIComponent(settings.branch)}`, { headers });
  let sha;
  if (existingResponse.ok) {
    sha = (await existingResponse.json()).sha;
  } else if (existingResponse.status !== 404) {
    throw await githubError(existingResponse);
  }

  const body = {
    message: `${sha ? "Update" : "Add"} ${submission.title} solution`,
    content: btoa(unescape(encodeURIComponent(submission.code))),
    branch: settings.branch
  };
  if (sha) {
    body.sha = sha;
  }

  const response = await fetch(apiUrl, {
    method: "PUT",
    headers,
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw await githubError(response);
  }

  return { path, url: (await response.json()).content.html_url, repository: `${settings.owner}/${settings.repo}` };
}

async function githubError(response) {
  let detail = response.statusText;
  try {
    detail = (await response.json()).message || detail;
  } catch {
    // Keep the HTTP status when GitHub does not return JSON.
  }
  return new Error(`GitHub: ${detail}`);
}

function slugify(value) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "leetcode-solution";
}

function languageExtension(language = "text") {
  const extensions = {
    cpp: "cpp",
    "c++": "cpp",
    java: "java",
    python: "py",
    python3: "py",
    javascript: "js",
    typescript: "ts",
    c: "c",
    csharp: "cs",
    "c#": "cs",
    go: "go",
    rust: "rs",
    kotlin: "kt",
    swift: "swift",
    ruby: "rb",
    php: "php"
  };
  return extensions[language.toLowerCase()] || "txt";
}
