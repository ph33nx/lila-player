# AGENTS.md

## Project Overview

Lila Player is a cross-platform local audio player desktop app for slowed+reverb/lofi audio effects. Built with Tauri 2 (Rust) + Next.js 15 + React 19.

## Philosophy

- **Write less code** — prefer deletion over addition
- **DRY** — extract shared logic into hooks/utils, never duplicate
- **SOLID** — single responsibility, open for extension
- **YAGNI** — don't build features until needed
- Favor composition over inheritance
- Keep components small and focused

## Commands

```bash
npm install          # Install deps
npm run tauri dev    # Dev mode
npm run tauri build  # Production build
npm run lint         # ESLint
npm run typecheck    # TypeScript check
npm run format       # Prettier
```

## Code Style

- TypeScript strict mode
- Functional components with hooks
- TailwindCSS for styling (no CSS modules)
- shadcn/ui components in `src/components/ui/`
- Custom hooks in `src/hooks/`
- Utils in `src/utils/`

## Architecture

```
src/
├── app/           # Next.js app router (single page)
├── components/    # React components
│   └── ui/        # shadcn/ui primitives
├── hooks/         # Custom React hooks
├── lib/           # Shared libraries
├── types/         # TypeScript types
└── utils/         # Utility functions
src-tauri/         # Rust/Tauri backend
```

## Versioning & Releases

- Update version in **both** `package.json` and `src-tauri/tauri.conf.json`
- Push to `master` branch triggers CI/CD build and release
- Workflow: `.github/workflows/publish.yml`
- Builds for: Windows (.msi/.exe), macOS (.dmg Intel & Apple Silicon), Linux (.AppImage/.deb/.rpm)

## Guidelines

- Audio processing uses Web Audio API in the frontend
- Tauri handles file dialogs and filesystem access
- State lives in React hooks, not global stores
- Prefer `const` arrow functions for components
- Export types from `src/types/`
- No `any` types — use proper typing or `unknown`
