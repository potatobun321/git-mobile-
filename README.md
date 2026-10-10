<p align="center">
  <img src="logo.png" width="72" height="72" alt=".gitmobile Logo">
</p>

<h1 align="center">.gitmobile</h1>

<p align="center">
  <strong>A portable, drop-in mobile Git control center & bridge.</strong><br>
  Manage your repositories, research papers, notes, commits, and sync workflows from your phone with one tap.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-2.0.0-blue.svg" alt="Version 2.0.0">
  <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="MIT License">
  <img src="https://img.shields.io/badge/platform-Termux%20%7C%20Windows%20%7C%20Linux%20%7C%20macOS-lightgrey.svg" alt="Platforms">
</p>

<p align="center">
  <a href="#quickstart-desktop--home-server-bridge">Desktop Bridge</a> •
  <a href="#quickstart-standalone-on-android-phone-termux">Android (Termux)</a> •
  <a href="#multi-repository-hub">Multi-Repository Hub</a> •
  <a href="#features">Features</a> •
  <a href="#updating--versioning">Updating & Versioning</a> •
  <a href="#changelog">Changelog</a>
</p>

---

## What is .gitmobile?

`.gitmobile` is a lightweight, self-healing Git client and bridge designed specifically for mobile ergonomics. It gives you a clean, GitHub Primer dark-mode interface on your phone to:
* **Multi-Repository Hub:** Register, clone, and switch seamlessly between 9+ different GitHub repositories right from your mobile navigation bar.
* **One-Tap Quick Sync:** Pull remote changes, auto-stage local modifications, and push upstream to GitHub with a single touch.
* **Visual Diff Viewer:** Inspect file additions and deletions before committing with clear syntax coloring.
* **Upload Papers & Documents:** Stream PDFs directly from your phone's downloads into your repository.
* **Mobile Notes Editor:** Jot down reading notes, ideas, and abstracts in Markdown and auto-commit them.
* **Interactive Terminal Runner:** Run any Git command (`branch -a`, `log -n 5`, `diff --stat`) straight from your phone.
* **Zero Cloud Lock-in:** 100% local, self-hosted, secured with OpenSSH and PIN-based LAN authentication.

---

## Quickstart: Desktop / Home Server Bridge

Run `.gitmobile` on your computer while keeping your phone connected over local Wi-Fi:

1. Clone this repository on your computer:
   ```bash
   git clone https://github.com/potatobun321/git-mobile-
   cd git-mobile-
   ```
2. Start the bridge:
   * **Windows:** Double-click `startup.bat` (or run `.\startup.bat` in PowerShell).
   * **Linux / macOS:** Run `bash startup.sh`.
3. The terminal displays a clean status readout and a scannable QR code:
   ```text
     gitmobile
     ---------
     Repository: C:\Users\GIGA\Desktop\GitMobile
     PIN Auth:   Enabled (3260)

     Scan with phone camera:
     [ ASCII QR Code ]

     Mobile URL: http://192.168.1.50:3000/?pin=3260
     Local URL:  http://localhost:3000/?pin=3260
   ```
4. Point your phone camera at the QR code — it will automatically open the dashboard and authenticate via PIN in one step!

---

## Quickstart: Standalone on Android Phone (Termux)

You can also run `.gitmobile` **entirely on your Android phone** without needing a computer:

1. Open **[Termux](https://github.com/termux/termux-app/releases)** on your Android device.
2. Run this single command:
   ```bash
   git clone https://github.com/potatobun321/git-mobile- && cd git-mobile- && bash startup.sh
   ```
3. `startup.sh` will:
   * Auto-install Node.js, Git, and OpenSSH.
   * Auto-configure your SSH key for GitHub.
   * Launch `.gitmobile` and automatically open `http://localhost:3000` in your phone browser!
4. *(Recommended)* Tap your mobile browser menu -> **"Add to Home Screen"** to install it as an app (PWA).

---

## Multi-Repository Hub

GitMobile includes full multi-repository management from the top header bar:

### 1. Switching Repositories
Tap the repository selector in the top header (`owner / repo ▾`). Choose any repository from the dropdown to instantly view its branches, uncommitted changes, commit log, and diffs.

### 2. Cloning from Remote Git URL
Tap the **`+`** button in the header -> select **Clone Remote**. Paste any Git URL:
```text
https://github.com/potatobun321/my-paper-repo.git
```
GitMobile will clone the repository into `.gitmobile/repos/<name>` on your host and add it to your dropdown switcher.

### 3. Linking an Existing Local Repository
Tap the **`+`** button -> select **Link Local**. Enter the local absolute folder path on your computer (e.g. `C:\Users\GIGA\Desktop\AnotherProject`). GitMobile will index it without moving any files.

---

## Features

| Feature | Description |
|---|---|
| **Multi-Repo Hub** | Seamlessly switch between multiple repositories, clone new repos, or link local directories from your phone. |
| **Visual Diff Viewer** | Modal dialog with green/red syntax highlighting to review changed lines before committing. |
| **One-Click Sync** | Pulls latest commits, stages uncommitted files, and pushes to remote with auto-upstream tracking. |
| **PIN Security & Auto-Auth** | 4-digit security PIN prevents unauthorized LAN access. Embedded directly into the terminal QR code for zero-friction sign-in. |
| **Port Failover** | Automatically detects port conflicts (`EADDRINUSE`) and safely rolls forward to an open port (3000–3010). |
| **PWA Support** | Web app manifest and service worker allow installing GitMobile directly to your iOS / Android home screen. |
| **Document Uploader** | Upload PDFs, documents, or images directly into `papers/` with automatic Git commit generation. |
| **Research Notes Editor** | Markdown editor with live preview, autosave, and auto-commit to `notes/`. |
| **Terminal CLI Drawer** | Run any Git command from your phone with quick suggestion chips (`branch -a`, `status`, `log -n 5`, `diff --stat`). |
| **Upstream Engine Updater** | Selectively updates `.gitmobile` core files from upstream without overwriting your papers, notes, or git commits. |

---

## Updating & Versioning

### How Versioning Works
GitMobile follows **Semantic Versioning** (`MAJOR.MINOR.PATCH`):
* **MAJOR (`2.x.x`)**: Substantial architecture upgrades (e.g., Multi-Repository Hub, new engine bridge).
* **MINOR (`x.1.x`)**: New user-facing features and backwards-compatible improvements (e.g., Diff viewer, auto PIN auth).
* **PATCH (`x.x.1`)**: Bug fixes, platform adjustments, and documentation improvements.

You can verify your running version at any time:
* In the Web UI: open the **Console** tab to view the engine version badge (e.g., `v2.0.0 • Up to date`).
* In the API: query `GET /api/engine/status`.

### Updating the Engine
If you cloned GitMobile into your own GitHub account or fork, you can update the `.gitmobile` engine without affecting your personal notes, papers, or commits:

* **From your phone:** Open the **Console** tab and tap **"Check for Updates"** / **"Update to Latest"**.
* **From your computer:**
  * Windows: Run `update.bat`
  * Linux / macOS / Termux: Run `bash update.sh`

The update engine pulls changes exclusively for `.gitmobile/`, `startup.bat`, `startup.sh`, `update.bat`, and `update.sh` from the official repository (`potatobun321/git-mobile-`). Your `config.json` and all repository files remain preserved.

---

## Changelog

### [v2.0.0] - 2026-10-10
* **Added Multi-Repository Hub**: Header repository selector with real-time switching across multiple projects.
* **Added Remote Cloning & Local Linking**: Clone any Git URL directly into `.gitmobile/repos/` or link existing folders on disk.
* **Added Visual Git Diff Viewer**: Inspect unified diffs with green/red syntax coloring for modified and staged files.
* **Added LAN PIN Authentication**: Auto-generated 4-digit PIN, persistent `config.json`, and one-scan QR code auto-login.
* **Added Port Failover**: Gracefully checks and selects alternative open ports on `EADDRINUSE`.
* **Added PWA Shell**: Web manifest and service worker for standalone fullscreen mobile operation.
* **Added Upstream Engine Updater**: In-app and script-based selective updating preserving user data.
* **Improved CLI Design**: Clean, unbloated terminal startup without emojis or misaligned ASCII boxes.

### [v1.0.0] - Initial Release
* Single-repository mobile Git bridge.
* Termux quickstart with automated SSH key setup.
* PDF / paper document upload handling.
* Markdown notes editor with auto-commit.
* Interactive terminal command runner.

---

## Troubleshooting

### "Permission denied (publickey)"
* Your SSH key is not authorized on GitHub yet.
* Copy your public key:
  * Windows: `type %USERPROFILE%\.ssh\id_ed25519.pub`
  * Termux / Linux: `cat ~/.ssh/id_ed25519.pub`
* Go to **[github.com/settings/ssh/new](https://github.com/settings/ssh/new)** and paste the key.
* Ensure Key type is set to **Authentication Key**.

### "The current branch has no upstream branch"
* `.gitmobile` handles this automatically on your first push! If running manually via terminal, use `git push -u origin <branch>` or run `git config push.autoSetupRemote true`.

### Cannot connect from phone over Wi-Fi
* Ensure both your phone and PC are connected to the same Wi-Fi network.
* If a Windows Firewall prompt appears, ensure you click **Allow** on private networks.
* Or connect your phone via USB cable and run: `adb reverse tcp:3000 tcp:3000`, then open `http://localhost:3000` on your phone.

---

## License
MIT License. Created for frictionless mobile version control.
