<p align="center">
  <img src="logo.png" width="72" height="72" alt=".gitmobile Logo">
</p>

<h1 align="center">.gitmobile</h1>

<p align="center">
  <strong>A portable, drop-in mobile Git control center & bridge.</strong><br>
  Manage your repositories, research papers, notes, commits, and sync workflows from your phone with one tap.
</p>

<p align="center">
  <a href="#quickstart-standalone-on-android-phone-termux">Android (Termux)</a> •
  <a href="#quickstart-desktop--home-server-bridge">Desktop Bridge</a> •
  <a href="#embed-into-an-existing-repository">Embed into Any Repo</a> •
  <a href="#features">Features</a> •
  <a href="#troubleshooting">Troubleshooting</a>
</p>

---

## What is .gitmobile?

`.gitmobile` is a lightweight, self-healing Git client and bridge designed specifically for mobile ergonomics. It gives you a clean, GitHub Primer dark-mode interface on your phone to:
* **One-Tap Quick Sync:** Pull remote changes, auto-stage local modifications, and push upstream to GitHub with a single touch.
* **Upload Papers & Documents:** Stream PDFs directly from your phone's downloads into your repository.
* **Mobile Notes Editor:** Jot down reading notes, ideas, and abstracts in Markdown and auto-commit them.
* **Interactive Terminal Runner:** Run any Git command (`branch -a`, `log -n 5`, `diff --stat`) straight from your phone.
* **Zero Cloud Lock-in:** 100% local, self-hosted, and secured by native Git and OpenSSH.

---

## Quickstart: Standalone on Android Phone (Termux)

You can run `.gitmobile` **entirely on your Android phone** without needing a computer:

1. Open **[Termux](https://github.com/termux/termux-app/releases)** on your Android device.
2. Run this single command:
   ```bash
   git clone https://github.com/potatobun321/git-mobile- && cd git-mobile- && bash startup.sh
   ```
3. `startup.sh` will:
   * Auto-install Node.js, Git, and OpenSSH.
   * Auto-configure your SSH key for GitHub.
   * Launch `.gitmobile` and automatically open `http://localhost:3000` in your phone browser!
4. *(Optional)* Tap your browser's menu (⋮) -> **"Add to Home Screen"** to install it as an app.

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
3. The terminal will display a **scannable ASCII QR code** and a copyable local URL:
   ```text
   ┌────────────────────────────────────────────────────────────┐
   │  📱 Mobile Access URL (Tap or Copy):                       │
   │  👉  http://192.168.1.50:3000                              │
   │                                                            │
   │  💻  Local Access: http://localhost:3000                   │
   └────────────────────────────────────────────────────────────┘
   ```
4. Point your phone camera at the terminal QR code or type the URL into your phone's browser!

---

## Embed into an Existing Repository

Want to give an existing repository mobile control?

1. Open a terminal inside your existing Git project:
   ```bash
   git clone https://github.com/potatobun321/git-mobile- .gitmobile
   cd .gitmobile
   ./start.sh   # or .\start.bat on Windows
   ```
2. Open the URL on your phone — `.gitmobile` will automatically detect and manage your existing repository.

---

## Updating .gitmobile from Upstream

Even if your repository points to your own personal GitHub account, you can update the `.gitmobile` engine at any time without touching your personal notes, papers, or git commits:

* **From your phone:** Open the **Console** tab and tap **"Check for Updates"** / **"Update to Latest"** (or click the update banner when a new release is detected).
* **From your computer:** Run `update.bat` (Windows) or `bash update.sh` (Linux / macOS / Termux).

This selectively pulls only the `.gitmobile` engine and startup scripts from the official upstream repository (`potatobun321/git-mobile-`).

---

## Features

| Feature | Description |
|---|---|
| **One-Click Sync** | Pulls latest commits, stages uncommitted files, and pushes to remote with auto-upstream tracking. |
| **Document Uploader** | Upload PDFs, documents, or images directly into `papers/` with automatic Git commit generation. |
| **Research Notes Editor** | Markdown editor with live preview, autosave, and auto-commit to `notes/`. |
| **Terminal CLI Drawer** | Run any Git command from your phone with quick suggestion chips (`branch -a`, `status`, `log -n 5`, `diff --stat`). |
| **Self-Healing Setup** | `startup.sh` auto-detects Termux vs Desktop, generates passphrase-free SSH keys, and pre-seeds GitHub host keys. |
| **GitHub Primer Aesthetics** | Authentic developer UI with crisp 6px radius cards, GitHub dark theme, and high-contrast badges. |

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
MIT License. Created with ❤️ for frictionless mobile version control.
