# ChatWrapped

A local-first desktop app to import, browse, and explore your Meta/Facebook Messenger data export. All processing happens on your machine—your messages never leave your device.

📖 **[User Guide](docs/USER_GUIDE.md)** — What the app does, what you need, and how to get your Messenger export from Meta.

![Electron](https://img.shields.io/badge/Electron-40-47848F?logo=electron)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Features

- **Import** — Select or drag-and-drop your Meta Messenger export ZIP; media is extracted and stored locally
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

- **macOS**: Download the `.zip` for your chip (arm64 for Apple Silicon, x64 for Intel), unzip, and move ChatWrapped to Applications.
- **Windows**: Download the `.exe` installer and run it.
- **Linux**: Download the `.deb` (Debian/Ubuntu) or `.rpm` (Fedora/RHEL) package and install with your package manager.

### Build from Source

**Prerequisites:** Node.js v20 or later (LTS recommended), npm

```bash
git clone https://github.com/pawarm/ChatWrapped.git
cd ChatWrapped
npm install
npm start
```

### How to Get Your Data

See the [User Guide](docs/USER_GUIDE.md) for a detailed step-by-step with screenshots. Quick version:

1. Go to [Meta Accounts Center](https://accountscenter.facebook.com/) → Your Information and Permissions → Download your Information
2. Select **Messages**, **JSON** format, and your date range
3. Wait for Meta to prepare the export (typically 24–72 hours)
4. Download the ZIP and import it in ChatWrapped

---

## Tech Stack

- **Electron** + **Electron Forge**
- **React 19** + **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui**
- **SQLite** (better-sqlite3)

---

## Scripts

| Command           | Description              |
|-------------------|--------------------------|
| `npm start`       | Start in development     |
| `npm run make`    | Build distributables      |
| `npm run lint`    | Run ESLint               |
| `npm run typecheck` | Type-check with tsc   |

---

## License

MIT © [Pawel Armatys](https://github.com/pawarm)
