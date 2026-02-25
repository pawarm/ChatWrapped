# Contributing to ChatWrapped

Thanks for helping build ChatWrapped! This guide will get you from zero to a running dev environment.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| **Rust** (stable) | 1.75+ | [rustup.rs](https://rustup.rs/) |
| **Bun** | 1.0+ | [bun.sh](https://bun.sh/) |
| **Tauri CLI** | 2.x | Installed via `bun install` (listed in devDependencies) |

### Platform-specific dependencies

Tauri v2 uses the system webview, so you need platform libraries:

- **macOS**: Xcode Command Line Tools (`xcode-select --install`). That's it.
- **Windows**: [Microsoft Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/), WebView2 (pre-installed on Windows 10/11).
- **Linux**: See the [Tauri prerequisites guide](https://v2.tauri.app/start/prerequisites/#linux) — you'll need `webkit2gtk`, `libappindicator`, and related system packages.

---

## Getting Started

```bash
# 1. Clone the repo
git clone https://github.com/pawarm/ChatWrapped.git
cd ChatWrapped

# 2. Install JS dependencies
bun install

# 3. Start the app in development mode
bun run tauri:dev
```

The first run will compile the Rust backend (takes 1-2 minutes). Subsequent runs are fast thanks to incremental compilation. The Vite dev server provides HMR for frontend changes — no restart needed.

---

## Project Structure

```
ChatWrapped/
├── src/                      # React frontend (TypeScript)
│   ├── pages/                #   Page components (Home, Import, Conversations)
│   ├── components/           #   UI and feature components
│   ├── hooks/                #   Custom React hooks
│   ├── lib/                  #   Utilities and Tauri API wrappers
│   └── types/                #   TypeScript type definitions
├── src-tauri/                # Rust backend
│   └── src/
│       ├── main.rs           #   Entry point
│       ├── lib.rs            #   Tauri builder, command registration
│       ├── db.rs             #   SQLite schema, migrations, init
│       ├── media.rs          #   Media directory management
│       ├── encoding.rs       #   Meta encoding fix (UTF-8/Latin1)
│       └── commands/
│           ├── db.rs         #   Database query commands
│           └── import.rs     #   ZIP import pipeline
├── docs/                     # Project documentation
├── scripts/                  # Dev utilities (test data generator)
└── package.json              # Scripts: dev, build, lint, typecheck
```

**Frontend** code lives in `src/`. It's React 19 + TypeScript + Tailwind CSS v4 + shadcn/ui components.

**Backend** code lives in `src-tauri/src/`. It's Rust using rusqlite for SQLite, the `zip` crate for extraction, and Tauri commands to expose functionality to the frontend.

The frontend calls the backend via `@tauri-apps/api` invoke — see `src/lib/api.ts` for the wrapper.

---

## Useful Commands

| Command | What it does |
|---------|-------------|
| `bun run tauri:dev` | Start the full app (Rust + Vite) in dev mode |
| `bun run dev` | Start only the Vite frontend dev server (no Rust) |
| `bun run tauri:build` | Build production distributables |
| `bun run lint` | Run ESLint |
| `bun run typecheck` | Type-check TypeScript |
| `bun run knip` | Find unused exports and dependencies |
| `bun run generate-test-data` | Generate a synthetic Messenger export ZIP for testing |

---

## Test Data

You don't need a real Messenger export to develop. Run the test data generator to create a synthetic ZIP:

```bash
bun run generate-test-data
```

This creates a ZIP file in `test-data/` that mimics the Meta export format with fake conversations, messages, and media references. Import it in the app to test your changes.

---

## Workflow

### Branching

1. Create a branch from `main` named after the issue: `git checkout -b 42-fts5-search`
2. Make your changes with clear, focused commits.
3. Push and open a PR against `main`.
4. Get one approval before merging.

### Commits

Write short, descriptive commit messages. Look at `git log --oneline` for the existing style. Examples:

- `Add FTS5 virtual table and search command`
- `Implement keyboard shortcuts for thread navigation`
- `Design empty state for conversations page`

### Pull Requests

- Keep PRs focused on one thing. Smaller is better.
- Include a screenshot or short description of what changed.
- If your PR adds a new Tauri command, document its parameters in the PR description.

### Code Style

- **TypeScript**: Follow the existing ESLint config. Run `bun run lint` before pushing.
- **Rust**: Use `cargo fmt` and `cargo clippy` in the `src-tauri/` directory.
- **CSS**: Use Tailwind utility classes. Avoid custom CSS unless necessary.
- **Components**: Follow the existing patterns in `src/components/`. Use shadcn/ui primitives where possible.

---

## Where to Contribute

Check the [GitHub Issues](https://github.com/pawarm/ChatWrapped/issues) for open tasks. Issues are labeled:

| Label | Meaning |
|-------|---------|
| `frontend` | React/TypeScript work in `src/` |
| `backend` | Rust work in `src-tauri/` |
| `design` | UX design, mockups, visual polish |
| `phase-1` | Current milestone |
| `good first issue` | A good starting point for new contributors |

---

## Architecture Notes

### How frontend talks to backend

The React app calls Rust functions through Tauri's `invoke` mechanism:

```typescript
// Frontend (src/lib/api.ts)
import { invoke } from '@tauri-apps/api/core';
const threads = await invoke<Thread[]>('get_threads');
```

```rust
// Backend (src-tauri/src/commands/db.rs)
#[tauri::command]
pub fn get_threads(state: State<'_, AppState>) -> Result<Vec<Thread>, String> {
    // query SQLite, return data
}
```

New commands must be registered in `src-tauri/src/lib.rs` via `.invoke_handler(tauri::generate_handler![...])`.

### Database

SQLite with tables: `threads`, `messages`, `reactions`, `media`. Schema is in `src-tauri/src/db.rs`. All data stays local in the Tauri app data directory.

### Media

Media files are extracted from the ZIP during import and stored in the app's data directory. The frontend accesses them via Tauri's asset protocol (`asset://`).

---

## Questions?

Open an issue or reach out. We're happy to help you get oriented.
