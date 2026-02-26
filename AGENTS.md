# Agent Guidelines for ChatWrapped

## Project Overview

Tauri v2 desktop app (Rust backend + React/TypeScript frontend) for importing and exploring Meta Messenger exports. Local-first, no server.

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui (New York style)
- **Backend:** Rust, Tauri v2, SQLite (rusqlite)
- **Package manager:** Bun (not npm/pnpm/yarn)
- **CI:** GitHub Actions

## Architecture

```
src/                    # Frontend
  components/ui/        # shadcn/ui primitives (kebab-case: button.tsx, skeleton.tsx)
  components/layout/    # Layout components (PascalCase: AppLayout.tsx)
  components/conversation/  # Domain components
  pages/                # Route pages (HomePage.tsx, ImportPage.tsx)
  lib/                  # Utilities (api.ts, utils.ts)
  hooks/                # Custom hooks (useDebounce.ts)
  types/                # Type definitions (conversation.ts)
src-tauri/src/          # Rust backend
  commands/             # Tauri command handlers
    import/             # Import pipeline submodules
  db.rs                 # Database setup & state
  models.rs             # Shared data models
  encoding.rs           # Meta encoding fix
  media.rs              # Media file handling
```

## Conventions

### TypeScript / React

- Functional components with hooks, named exports: `export function MyComponent()`
- Absolute imports with `@/` alias: `import { Button } from '@/components/ui/button'`
- Use `import type` for type-only imports
- State management via `useState`/`useEffect` — no Redux/Zustand
- All Tauri calls go through `src/lib/api.ts`, never call `invoke()` directly from components
- Use `cn()` from `@/lib/utils` for conditional class names (clsx + tailwind-merge)
- Strict TypeScript: `noUnusedLocals`, `noUnusedParameters`, `strictNullChecks` are all enabled

### File Naming

- React components: **PascalCase** (`MessageView.tsx`, `HomePage.tsx`)
- shadcn/ui primitives: **kebab-case** (`button.tsx`, `skeleton.tsx`)
- Utilities, hooks, types: **camelCase** (`api.ts`, `useDebounce.ts`, `conversation.ts`)
- Rust modules: **snake_case** (`meta_format.rs`, `pipeline.rs`)

### Rust

- Tauri commands return `Result<T, String>` — convert errors with `.map_err(|e| e.to_string())`
- Structs use `#[serde(rename_all = "camelCase")]` for frontend serialization
- Commands take `AppHandle` as first parameter for state access
- Run `cargo fmt` and `cargo clippy -- -D warnings` before committing

### Commits

- Use conventional commits for automatic version bumping:
  - `feat: ...` → minor version bump
  - `fix: ...` → patch version bump
  - `feat!: ...` or `BREAKING CHANGE` → major version bump
  - `chore: ...`, `refactor: ...`, `docs: ...` → patch version bump

### CI

- `bun install --frozen-lockfile` in CI (never plain `bun install`)
- Frontend checks: `bun run lint`, `bun run typecheck`, `bun run knip`
- Rust checks: `cargo fmt --check`, `cargo clippy -- -D warnings`, `cargo test`
- Merging to `main` auto-releases after CI passes

## Things to Avoid

- Don't add `npm`, `pnpm`, or `yarn` lockfiles — this project uses Bun
- Don't bypass the `api.ts` layer to call Tauri `invoke()` directly
- Don't use `let` where `const` suffices
- Don't leave unused imports or variables — ESLint and TypeScript strict mode will catch them
- Don't add dependencies without checking if Bun and Tauri are compatible
