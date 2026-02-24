# ChatWrapped — Application Overview

A detailed overview of the ChatWrapped application: vision, architecture, features, and roadmap.

---

## 1. Executive Summary

**ChatWrapped** is a local-first desktop application that lets users import their Meta/Facebook Messenger data export, store it in a local database, and explore it through search, browsing, and interactive analytics. The app runs entirely on the user's machine; no data is uploaded or sent anywhere.

---

## 2. Vision & Purpose

### Core Goals

- **Personal insights** — Turn years of messaging history into visual, explorable data.
- **Privacy-first** — All processing happens locally; sensitive data never leaves the device.
- **Practical utility** — Browse and search old conversations, find photos and voice memos, export views.
- **Discovery & fun** — Surprising stats, word clouds, timelines, and “your year in messages”–style summaries.

### Use Cases

- Revisit old conversations and media.
- See how messaging habits and vocabulary differ across chats and groups.
- Identify most active relationships and how they evolved over time.
- Analyze reaction and emoji usage.
- Extract and explore shared links, photos, and voice memos.

---

## 3. Data Source: Meta Messenger Export

### How Users Get Their Data

1. Go to [Meta Accounts Center](https://accountscenter.facebook.com/) → Your Information and Permissions → Download your Information.
2. Choose "Messages", JSON format, and date range.
3. Wait 24–72 hours for Meta to prepare the export.
4. Download the ZIP file and import it into ChatWrapped.

### Export Structure

```
messages/
├── inbox/                    # Standard (non-E2EE) conversations
│   ├── chatname_abc123/
│   │   ├── message_1.json    # One or more message files per chat
│   │   ├── message_2.json
│   │   └── media/            # Photos, videos, etc.
│   └── ...
├── encrypted/                # End-to-end encrypted 1:1 chats (newer exports)
│   └── ...
└── e2ee_cutover/             # Migration metadata
```

### Message JSON Schema

Each `message_*.json` file contains:

| Field | Type | Description |
|-------|------|-------------|
| `participants` | `{ name: string }[]` | Chat participants |
| `messages` | `Message[]` | Messages (reverse chronological) |
| `title` | string | Conversation title |
| `thread_type` | string | e.g. `RegularGroup`, `Regular` |

Individual message object:

| Field | Type | Description |
|-------|------|-------------|
| `sender_name` | string | Sender display name |
| `timestamp_ms` | number | Unix timestamp (ms) |
| `content` | string? | Text content (optional for media-only) |
| `photos` | object[]? | Photo attachments |
| `videos` | object[]? | Video attachments |
| `gifs` | object[]? | GIF attachments |
| `audio_files` | object[]? | Voice memos, audio |
| `files` | object[]? | File attachments |
| `sticker` | object? | Sticker |
| `share` | object? | Shared link |
| `type` | string? | e.g. `Share`, `Generic` |
| `reactions` | `{ reaction, actor }[]?` | Message reactions |
| `plan` | object? | Event/plan (date/time) |

### Special Message Types

Messages are classified into special types based on content patterns and metadata. The `special_type` column stores:

| Type | Description |
|------|-------------|
| `group_event` | Group management: "X named the group", "X added/removed Y", "X left the group" |
| `poll_creation` | "X created a poll: …" |
| `poll_vote` | "X voted for … in the poll", "X changed/removed their vote" |
| `live_location` | "X sent a live location" |
| `share` | Has `share` object (link/share_text from Meta) |
| `edited` | Content ends with " (edited)" (when no other type matches) |
| `generic` / null | Regular user messages |

**Analytics filtering:** Future analytics (word frequency, activity charts, phrase analysis) should exclude system/automated messages for more meaningful results. Use:

```sql
WHERE (special_type IS NULL OR special_type NOT IN ('group_event', 'poll_creation', 'poll_vote', 'live_location'))
```

The special type classification logic lives in the Rust backend at `src-tauri/src/commands/import.rs`.

### Considerations

- **E2EE (2025+)** — Many 1:1 chats may be encrypted; group chats typically remain in `inbox/`.
- **Split exports** — Large exports may be split by date; the importer must merge them.
- **Reverse order** — Messages are reverse chronological; app should normalize to chronological for display and analytics.

---

## 4. Technology Stack

| Layer | Technology |
|-------|------------|
| **Desktop shell** | Tauri v2 |
| **Backend** | Rust (rusqlite, zip, serde) |
| **Frontend** | React 19 + TypeScript |
| **Build** | Vite + Bun |
| **Database** | SQLite (rusqlite with bundled feature) |
| **Charts/visualizations** | TBD (Recharts, D3, or Visx) |

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Tauri Core (Rust)                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │ File I/O    │  │ ZIP Extract  │  │ SQLite Database │  │
│  │ (Meta ZIP)  │  │ (zip crate)  │  │ (rusqlite)      │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
└───────────────────────────┬─────────────────────────────┘
                            │ Tauri Commands (invoke)
┌───────────────────────────▼─────────────────────────────┐
│                   Webview (Frontend)                      │
│  ┌─────────────────────────────────────────────────┐   │
│  │              React Application                    │   │
│  │  Routes • Components • State • Charts            │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## 5. Feature Domains

### Domain 1: Import & Data Management

**Purpose:** Load and persist Meta exports for fast querying.

| Feature | Description |
|---------|-------------|
| Import wizard | Select or drag-and-drop Meta ZIP file |
| Progress feedback | Progress for extraction and parsing |
| Incremental import | Re-import or add new exports without losing prior data |
| Schema migration | Handle future Meta format changes |
| Media path resolution | **Done** — Media extracted from ZIP, stored locally, displayed inline |

**Data model (SQLite):**

```
threads          (id, title, thread_type, participants_json, created_at)
messages         (id, thread_id, sender_name, timestamp_ms, content, content_type, special_type, ...)
reactions        (message_id, actor, reaction_type)
media            (id, message_id, media_type, relative_path, mime_type, sort_order)
```

The `special_type` column classifies messages for display and analytics (see [Special Message Types](#special-message-types)).

---

### Domain 2: Conversation Browser

**Purpose:** Browse chats and read messages like a standard messenger.

| Feature | Description |
|---------|-------------|
| Thread list | All conversations with search/filter/sort |
| Message view | Chat-style layout with media inline |
| Infinite scroll | Handle very long threads efficiently |
| Full-text search | Search across all messages |
| Date navigation | Jump to a date in a conversation |
| Media gallery | View photos/videos inline in chat (dedicated gallery view not yet) |

---

### Domain 3: Time & Activity Analytics

**Purpose:** Understand when and how much you message.

| Feature | Description |
|---------|-------------|
| Activity by time | Hour, day, week, month, year |
| Heatmaps | Day-of-week × hour-of-day |
| Timeline | Most active chats/users per period |
| Response time | Who replies quickly; patterns by time of day |
| Streaks | E.g. “talked every day for N days” |

---

### Domain 4: Language & Content Analytics

**Purpose:** Analyze word choice and phrases.

| Feature | Description |
|---------|-------------|
| Word frequency | Per chat, per user, with stopword filtering |
| Phrase analysis | Common n-grams (2–4 words) |
| Signature phrases | Phrases most unique to a chat or person |
| Word clouds | Visual word distributions |
| Sentiment (optional) | Basic sentiment over time |

---

### Domain 5: Media Analytics

**Purpose:** Understand media usage patterns.

| Feature | Description |
|---------|-------------|
| Media by type | Photos, videos, voice memos, GIFs, stickers |
| Distribution | Which chats/users send most media |
| Voice memo usage | Voice vs text over time |
| Shared links | By domain or category |
| Media timeline | Map or timeline of when/where media was sent |

---

### Domain 6: Reactions & Engagement

**Purpose:** Analyze reaction behavior.

| Feature | Description |
|---------|-------------|
| Reaction frequency | Per user, per chat |
| Reactor mapping | Who reacts most to whom |
| Trends | Reactions over time |
| Most reacted messages | Top messages by reaction count |

---

### Domain 7: Cross-Conversation Insights

**Purpose:** Aggregate and comparative views.

| Feature | Description |
|---------|-------------|
| Year in messages | Recap: top chats, words, emojis |
| Relationship timelines | Activity per person over time |
| Compare contexts | 1:1 vs group chat language |
| Persona view | How you write in different chats |

---

## 6. Potential Future Features

- **“Your Year in Messages”** — Yearly recap with highlights
- **Relationship timelines** — Visual evolution of key relationships
- **Emoji evolution** — How emoji usage changed over time
- **Inside jokes** — Phrases that appear only in specific chats
- **Export views** — HTML or PDF of stats or recaps
- **Multi-export comparison** — Compare exports from different dates
- **Other platforms** — WhatsApp, Telegram (if export formats are supported)

---

## 7. Privacy & Security

| Principle | Implementation |
|-----------|----------------|
| No cloud | All processing and storage on the user’s machine |
| No telemetry | No usage tracking or analytics |
| Local DB | SQLite stored in app data; optional encryption for extra security |
| Transparent | Open source; users can verify behavior |
| Data stays put | No uploads; media paths reference local files |

---

## 8. Development Roadmap

### Phase 1: Foundation
- [x] Import pipeline (ZIP extraction, JSON parsing, media extraction)
- [x] SQLite schema and persistence
- [x] Basic conversation browser (list + message view, infinite scroll)
- [x] Full-text search
- [x] Media display (photos, videos, audio, files inline)
- [x] Message histogram / jump to date

### Phase 2: Core Analytics
- [x] Basic activity view (message histogram per thread)
- [ ] Time/activity charts (hour, day, month, heatmaps)
- [ ] Word frequency and emoji stats
- [ ] Content-type breakdown (text, photos, voice, etc.)

### Phase 3: Advanced Analytics
- [ ] Phrase analysis and signature phrases
- [ ] Reaction analytics
- [ ] Media distribution
- [ ] Timeline views

### Phase 4: Polish
- [ ] Year in messages
- [ ] Export to HTML/PDF
- [ ] UI polish and performance tuning

---

## 9. Known Constraints & Risks

| Constraint | Mitigation |
|------------|------------|
| E2EE exports | Support both `inbox/` and `encrypted/`; document limitations |
| Format changes | Version detection; flexible parser with fallbacks |
| Large exports | Streaming/chunked import; SQLite indexes; progress UI |
| Cross-platform | Electron supports Windows, macOS, Linux |

---

## 10. References

- [Meta: Download your information](https://www.facebook.com/help/212802592074644/)
- [Electron Forge](https://www.electronforge.io/)
- [MessengerDataAnalysis](https://github.com/EricEzaM/MessengerDataAnalysis) — existing open-source reference
- [DuckCIT Facebook Messenger JSON Viewer](https://github.com/DuckCIT/Facebook-Messenger-JSON-Viewer) — JSON structure reference
