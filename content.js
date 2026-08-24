let lastAcceptedText = "";
let lastCode = "";

const observer = new MutationObserver(() => {
  const acceptedNode = findAcceptedNode();
  const accepted = acceptedNode && acceptedNode !== lastAcceptedText;
  if (!accepted) {
    return;
  }

  lastAcceptedText = acceptedNode;
  captureAndSend().catch(() => {
    // The extension can be reloaded while a submission is being captured.
  });
});

observer.observe(document.body, { childList: true, subtree: true, characterData: true });

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "sync-current") {
    return;
  }
  const code = readEditorCode();
  if (!code) {
    sendResponse({ ok: false, error: "The code editor is empty or not available." });
    return;
  }
  sendSubmission(code);
  sendResponse({ ok: true });
});

async function captureAndSend() {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = readEditorCode();
    if (code && code !== lastCode) {
      lastCode = code;
      sendSubmission(code);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  safeSendMessage({ type: "sync-error", error: "Accepted, but the code editor was not readable." });
}

function sendSubmission(code) {
  lastCode = code;
  safeSendMessage({
    type: "accepted-submission",
    submission: {
      title: readTitle(),
      language: readLanguage(),
      code,
      url: window.location.href
    }
  });
}

function safeSendMessage(message) {
  try {
    chrome.runtime.sendMessage(message).catch(() => {
      // The page may still contain a content script from before an extension reload.
    });
  } catch {
    // Ignore a stale content script; refreshing the page installs the current one.
  }
}

function findAcceptedNode() {
  return [...document.querySelectorAll("body *")]
    .find((element) => element.children.length === 0 && /^accepted$/i.test(element.textContent.trim()))
    ?.textContent.trim() || "";
}

function readTitle() {
  const heading = document.querySelector("h1");
  return heading?.textContent?.replace(/^\d+\.\s*/, "").trim() || location.pathname.split("/")[2] || "leetcode-solution";
}

function readLanguage() {
  const languageButton = [...document.querySelectorAll("button")].find((button) => /^(C\+\+|Java|Python|Python3|JavaScript|TypeScript|Go|Rust|C#|Kotlin|Swift|Ruby|PHP)$/i.test(button.textContent.trim()));
  return languageButton?.textContent.trim() || "text";
}

function readEditorCode() {
  const editor = document.querySelector('textarea[aria-label="Code editor"]');
  if (editor?.value?.trim()) {
    return editor.value.trim();
  }

  const lines = [...document.querySelectorAll(".view-lines .view-line, pre code, textarea")];
  const code = lines.map((line) => line.value ?? line.textContent ?? "").join("\n").trim();
  return code.length > 20 ? code : "";
}
