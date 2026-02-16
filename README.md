# ChatWrapped

A local-first desktop app to import, browse, and explore your Meta/Facebook Messenger data export. All processing happens on your machine—your messages never leave your device.

![Electron](https://img.shields.io/badge/Electron-40-47848F?logo=electron)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Features

- **Import** — Select or drag-and-drop your Meta Messenger export ZIP
- **Browse** — View conversations with infinite scroll and date navigation
- **Search** — Search across conversations or within messages
- **Reactions** — See who reacted and how
- **Privacy** — Everything runs locally; no cloud, no uploads

---

## Getting Started

### Prerequisites

- Node.js (LTS recommended, e.g. v20+)
- npm

### Install & Run

```bash
git clone https://github.com/pawarm/ChatWrapped.git
cd ChatWrapped
npm install
npm start
```

### How to Get Your Data

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

## Project Structure

```
src/
├── index.ts       # Electron main process entry
├── main/          # Main process logic (DB, import, IPC handlers)
├── pages/         # Route pages (Home, Import, Conversations)
├── components/    # UI components (layout, conversation view, ui)
├── hooks/         # React hooks (e.g. useDebounce)
├── lib/           # Utilities (cn, fixMetaEncoding)
└── types/         # TypeScript types
```

---

## Scripts

| Command       | Description                    |
|---------------|--------------------------------|
| `npm start`   | Start the app in development   |
| `npm run make`| Build distributables           |
| `npm run lint`| Run ESLint                     |
| `npm run typecheck` | Type-check with tsc       |

---

## License

MIT © [Pawel Armatys](https://github.com/pawarm)
