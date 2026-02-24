# ChatWrapped

A local-first desktop app to import, browse, and explore your Meta/Facebook Messenger data export. All processing happens on your machine—your messages never leave your device.

[User Guide](docs/USER_GUIDE.md) — What the app does, what you need, and how to get your Messenger export from Meta.

![Tauri](https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![Rust](https://img.shields.io/badge/Rust-Backend-DEA584?logo=rust)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Features

- **Import** — Select your Meta Messenger export ZIP files; media is extracted and stored locally
- **Media display** — View photos, videos, GIFs, audio, and files inline in the message view
- **Browse** — View conversations with infinite scroll, date picker, and a message histogram to jump to any date
- **Search** — Search across conversations or within messages; click a result to open it
- **Reactions** — See who reacted and how
- **Stats** — Home dashboard shows conversation count, message count, word count, and date range
- **Data management** — Clear all imported data and re-import at any time
- **Privacy** — Everything runs locally; no cloud, no uploads, no telemetry

---

## Getting Started

### Download

Pre-built releases for Windows, macOS (Intel and Apple Silicon), and Linux are available on [GitHub Releases](https://github.com/pawarm/ChatWrapped/releases).

- **macOS**: Download the `.dmg` for your chip (arm64 for Apple Silicon, x64 for Intel) and install.
- **Windows**: Download the `.msi` installer and run it.
- **Linux**: Download the `.deb` (Debian/Ubuntu) or `.AppImage` and install.

### Build from Source

**Prerequisites:** [Rust](https://rustup.rs/) (stable), [Bun](https://bun.sh/) v1+

```bash
git clone https://github.com/pawarm/ChatWrapped.git
cd ChatWrapped
bun install
bun run tauri:dev
```

For a production build:

```bash
bun run tauri:build
```

### How to Get Your Data

See the [User Guide](docs/USER_GUIDE.md) for a detailed step-by-step with screenshots. Quick version:

1. Go to [Meta Accounts Center](https://www.facebook.com/accountscenter/) → Your Information and Permissions → Download your Information
2. Select **Messages**, **JSON** format, and your date range
3. Wait for Meta to prepare the export (typically 24–72 hours)
4. Download the ZIP and import it in ChatWrapped

---

## Tech Stack

- **Tauri v2** — Desktop shell (Rust backend, system webview)
- **React 19** + **TypeScript** — Frontend
- **Vite** — Build tooling
- **Bun** — JavaScript runtime and package manager
- **Tailwind CSS v4** + **shadcn/ui** — Styling
- **SQLite** (rusqlite) — Local database
- **Rust** — Backend logic (ZIP processing, database, media storage)

---

## Scripts

| Command | Description |
|---|---|
| `bun run dev` | Start Vite dev server |
| `bun run tauri:dev` | Start Tauri in development |
| `bun run tauri:build` | Build production distributables |
| `bun run build` | Build frontend only |
| `bun run lint` | Run ESLint |
| `bun run typecheck` | Type-check with tsc |

---

## License

MIT © [Pawel Armatys](https://github.com/pawarm)
