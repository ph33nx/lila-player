# AGENTS.md

Lila Player: cross-platform local audio player for slowed + reverb / lofi effects — Tauri 2 (Rust) + Next.js 15 + React 19, shipped as a desktop app and a GitHub Pages web app from one static export.

## Philosophy

- Write less code — prefer deletion over addition
- DRY — extract shared logic into hooks/utils, never duplicate
- SOLID — single responsibility, open for extension
- YAGNI — don't build features until needed
- Favor composition over inheritance
- Keep components small and focused

## Code style

- TypeScript strict mode, no `any` — use proper typing or `unknown`
- Functional components only, declared as `const` arrow functions
- Tailwind for all styling, no CSS modules
- shadcn/ui primitives live in `src/components/ui/`
- Engine logic lives in `src/engine/` — no React inside it
- Custom hooks in `src/hooks/`, utilities in `src/utils/`, types exported from `src/types/`

## File access

File open is the webview's `<input type="file">`, which opens the native OS file picker; export is a `Blob` built in-page and downloaded via `<a download>`. The Rust side is a thin shell around the window and bundler — it does not mediate file dialogs or filesystem access.

## Verify gate

```bash
npm run verify
```

Add `(cd src-tauri && cargo build)` if anything under `src-tauri/` changed.

## Releases

The version lives in `package.json`; `tauri.conf.json` reads it from there. Push to `main` (not `master`) triggers `.github/workflows/publish.yml`. Details: docs/release.md.

## Dependencies

Periodic upkeep, the hold list, and known advisories: docs/dependencies.md.

## Docs

Start at docs/index.md. For the full commands list, see the README's Scripts table.
