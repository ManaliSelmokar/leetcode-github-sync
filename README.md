# LeetCode GitHub Sync

LeetCode GitHub Sync is a Manifest V3 browser extension for saving accepted LeetCode submissions to a GitHub repository. It runs locally in Chrome or Microsoft Edge and communicates with GitHub through the Contents API.

## Features

- Detects accepted submissions on LeetCode problem pages.
- Reads the active solution and programming language from the editor.
- Creates or updates one source file per problem.
- Supports automatic sync and a manual **Sync current solution** action.
- Sends desktop notifications for successful and failed syncs.
- Stores configuration in the browser extension's local storage.

## Architecture

```text
LeetCode page
    |
    | content.js observes accepted results and reads the editor
    v
Background service worker (background.js)
    |
    | reads settings, checks existing file, creates or updates content
    v
GitHub Contents API
    |
    v
Configured repository branch
```

### Components

- `manifest.json`: Manifest V3 metadata, permissions, host access, popup, content script, and service worker registration.
- `content.js`: Watches LeetCode result changes, extracts problem metadata and editor code, and sends submissions to the service worker.
- `popup.html`, `popup.css`, `popup.js`: Provides the status view, settings panel, and manual sync action.
- `background.js`: Reads configuration, calls the GitHub Contents API, updates sync status, and creates notifications.
- `icon.png`: PNG notification icon required by the browser notification API.

## Installation

1. Clone or download this repository.
2. Open `chrome://extensions` in Chrome, or `edge://extensions` in Microsoft Edge.
3. Enable **Developer mode**.
4. Select **Load unpacked**.
5. Select the `leetcode-github-sync` directory.
6. Open the extension popup and select the settings button.

## Configuration

Create a GitHub **fine-grained personal access token** with the following scope:

- Repository access: **Only select repositories**, limited to the destination repository.
- Repository permissions: **Contents: Read and write**.
- Metadata: **Read-only** (normally selected automatically).

Enter the token and destination details in the settings panel:

- Owner: GitHub account or organization that owns the repository.
- Repository: Destination repository name.
- Branch: Branch to receive solution commits.
- Folder: Root folder for generated solution directories.

The token is stored only in the browser's extension storage. It is sent to `api.github.com` as an authorization header and is never written to repository files. Use a repository-scoped token with an expiration date, and revoke it if it is exposed.

## File layout

For a problem titled `Two Sum` in C++, the default output is:

```text
solutions/
└── two-sum/
    └── solution.cpp
```

If the file already exists, the extension updates it using its GitHub file SHA. Each create or update operation produces a commit on the configured branch.

## Notifications

After a successful upload, the extension sends a notification in this format:

```text
Added "<problem title>" to "<owner>/<repository>"
```

The extension also notifies you when capture, authentication, permissions, or GitHub API requests fail. Browser and operating-system notification settings must allow notifications from the browser for these messages to appear.

## Limitations

- LeetCode's editor and result markup can change, which may require updates to `content.js`.
- The extension reads the currently visible editor; it does not import historical submissions.
- GitHub API access requires an internet connection and a valid token with repository Contents write permission.
- This is a local unpacked extension. Publishing it to a browser extension store requires separate packaging, review, and privacy documentation.

## Development

No build step or third-party dependency is required. After changing extension files, reload the unpacked extension from the browser's extensions page and refresh open LeetCode tabs so they receive the new content script.

For debugging, inspect the extension service worker from the extensions page and inspect the LeetCode tab's console for content-script errors.

## Privacy

This extension is designed to communicate with only:

- `leetcode.com`, to read the current problem and editor content.
- `api.github.com`, to read and write configured repository files.

It does not include analytics, a remote backend, or telemetry.
