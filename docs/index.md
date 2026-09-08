# docs/index.md

Router for Lila Player's docs. Each doc owns one concern; go straight to the one for what you're touching.

- `architecture.md` — component structure, state binding, Tauri vs Pages targets, base path.
- `audio-engine.md` — the Web Audio graph, playback, export, loop.
- `testing.md` — unit and e2e test setup and conventions.
- `release.md` — versioning, CI, the release workflow, Pages deploy.
- `dependencies.md` — dependency upkeep, hold list, known advisories.
- `decisions.md` — ADR-lite: decisions made and when to revisit them.

## Doc rules

- Under 150 lines each, most important fact first.
- Link instead of repeating — one fact has one home.
- No dates beside claims; history lives in git.
- Every functional change updates its doc in the same commit.
