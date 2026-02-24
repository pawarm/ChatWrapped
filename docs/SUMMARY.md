# ChatWrapped — Development Summary

A summary of what has been implemented in the ChatWrapped application.

---

## 1. Completed Features

### Import Pipeline

- **ZIP import** — Users can select Meta Messenger export ZIP files via native file dialog
- **Progress feedback** — Extracting, parsing, and writing phases with progress bar and thread name
- **Format support** — Parses `messages/inbox/`, `messages/encrypted/`, and `messages/e2ee_cutover/` structures
- **Merged threads** — Multiple `message_*.json` files per conversation are merged correctly
- **Duplicate handling** — Deduplication of messages across split files
- **Encoding fix** — Handles Meta's UTF-8-in-Latin1 JSON encoding (Polish characters, emojis)
- **Reactions** — Imports message reactions (actor + reaction type)
- **Media extraction** — Photos, videos, GIFs, audio, files, and stickers extracted from ZIP and stored in app data
- **Data model** — `threads`, `messages`, `reactions`, and `media` tables in SQLite with appropriate indexes

### Database

- **SQLite** — Local storage via `rusqlite` (Rust)
- **Schema** — `threads`, `messages`, `reactions`, `media` tables with foreign keys and indexes
- **Storage location** — Database file in Tauri app data directory
- **Tauri commands** — Rust backend exposes commands for all read operations

### Conversation Browser

- **Thread list** — All conversations with message count and last activity
- **Search conversations** — Filter threads by title or participant names
- **Sort** — By recent activity or by name
- **Message view** — Chat-style layout with sender, timestamp, and content
- **Infinite scroll** — Load older messages on scroll-to-top (50 messages per batch)
- **Reactions display** — Shows who reacted with which emoji
- **Date navigation** — Date picker and message histogram (JumpToDateBar) to jump to any date
- **Media display** — Photos, videos, GIFs, audio, and files shown inline via Tauri asset protocol

### Search

- **Full-text search** — Search across all messages
- **Debounced input** — 400ms debounce for message search, 300ms for thread search
- **Results** — Thread title, sender, timestamp, and content snippet
- **Click-through** — Selecting a result opens that conversation

### Home & Data

- **Stats dashboard** — Conversation count, message count, reactions, word count, date range
- **Clear data** — Remove all imported data from the Import page

### UI & Navigation

- **Layout** — Sidebar navigation (Home, Conversations, Import) + main content area
- **Routing** — React Router with HashRouter (`/`, `/import`, `/conversations`, `/conversations/:threadId`)
- **Design** — Tailwind CSS v4 + shadcn/ui (new-york style, neutral base)
- **Responsive** — Conversations page uses a two-panel layout (thread list + message view)

### Technical

- **Tauri v2** — Rust backend with commands, asset protocol for media
- **Vite** — Frontend build with HMR
- **Bun** — JavaScript runtime and package manager
- **TypeScript** — Full type coverage
- **CI/CD** — GitHub Actions for multi-platform builds with Tauri Action

---

## 2. Project Structure

```
src/
├── app.tsx              # App entry, routes
├── renderer.ts          # Vite entry for frontend
├── index.css            # Tailwind + theme variables
├── pages/
│   ├── HomePage.tsx
│   ├── ImportPage.tsx
│   └── ConversationsPage.tsx
├── components/
│   ├── layout/
│   │   ├── AppLayout.tsx
│   │   └── MainNav.tsx
│   ├── conversation/
│   │   ├── MessageView.tsx    # Chat-style layout, media, special types
│   │   └── JumpToDateBar.tsx  # Message histogram, jump to date
│   ├── ui/
│   │   ├── button.tsx
│   │   └── skeleton.tsx
│   └── ErrorBoundary.tsx
├── hooks/
│   └── useDebounce.ts
├── lib/
│   ├── api.ts           # Tauri invoke wrapper
│   └── utils.ts         # cn() utility
└── types/
    ├── conversation.ts  # Thread, Message, SearchResult
    └── import.ts        # ImportSummary, ImportProgress

src-tauri/
├── Cargo.toml           # Rust dependencies
├── tauri.conf.json      # Tauri app configuration
├── build.rs             # Tauri build script
└── src/
    ├── main.rs          # Rust entry point
    ├── lib.rs           # Tauri builder, command registration
    ├── db.rs            # SQLite init, schema, migrations
    ├── media.rs         # Media directory management
    ├── encoding.rs      # Meta encoding fix (UTF-8/Latin1)
    └── commands/
        ├── mod.rs
        ├── db.rs        # Database query commands
        └── import.rs    # ZIP import pipeline
```

---

## 3. Not Yet Implemented

- **Media gallery** — Dedicated view to browse photos/videos per conversation or globally
- **Analytics** — Time charts, word frequency, emoji stats, activity heatmaps, dashboard
- **Export** — Export to HTML/PDF
- **Full-text search index** — Currently uses `LIKE`; FTS5 would scale better for large datasets
- **Drag-and-drop** — File selection uses native dialog; drag-and-drop support to be added
