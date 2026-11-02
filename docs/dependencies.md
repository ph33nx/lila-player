# Dependency Maintenance

Periodic dependency + security upkeep for Lila Player. Run every 4-8 weeks, or whenever Dependabot opens alerts.

**Two package managers, kept in lockstep:**

| Ecosystem             | Manifest               | Lockfile               | Refresh tool                | Advisory tool |
| --------------------- | ---------------------- | ---------------------- | --------------------------- | ------------- |
| npm (frontend)        | `package.json`         | `package-lock.json`    | `npm-check-updates` (`ncu`) | `npm audit`   |
| Cargo (Tauri backend) | `src-tauri/Cargo.toml` | `src-tauri/Cargo.lock` | `cargo update`              | `cargo audit` |

**Done means the gate is green, never skip it:** `npm run verify` (npm side) and `(cd src-tauri && cargo build)` (Rust side). The lefthook hooks are a subset of it.

---

## Hold list (do NOT bump these to their latest major)

Bumping any of these is a deliberate, separate migration, not part of a routine pass. Keep them on the latest **minor/patch within the current major**.

| Package              | Pin to           | Why held                                                                                                                                |
| -------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `typescript`         | 5.x              | 6/7 are the native-compiler majors; migrate on purpose, not in a sweep                                                                  |
| `tailwindcss`        | 3.x              | v4 is a CSS-first rewrite (`@import "tailwindcss"`, `@theme`, `@tailwindcss/postcss`, HSL format changes). Big surface for a small app. |
| `tailwind-merge`     | 2.x              | v3 **drops Tailwind v3 support**. Tied to `tailwindcss` — move both together or neither.                                                |
| `next`               | 15.x             | v16 removes `next lint` (already warns), changes Turbopack defaults. Do the codemod migration deliberately.                             |
| `eslint`             | 9.x              | ESLint 10 tooling tracks Next 16. Keep with Next.                                                                                       |
| `eslint-config-next` | = `next` version | Always matches the Next version exactly (`15.5.x`).                                                                                     |

Everything not on this list: upgrade to latest, gate on the verify steps, hold only if it actually breaks the build.

---

## Blind-session setup (tooling is often absent on a fresh box)

- **Node** 20+ (24 is fine). Already present in most environments.
- **Rust toolchain** — `cargo`/`rustc` are frequently NOT installed. Install via rustup, then `source "$HOME/.cargo/env"` in every shell (state does not persist between commands). Exact command: README > Development > Rust.
- **Tauri Linux build deps** — without them `cargo build` fails at the webkit link step. `pkg-config` + `libwebkit2gtk-4.1-dev` + the rest: README > Development > Linux. Verify with `pkg-config --modversion webkit2gtk-4.1`.

Do not duplicate the install commands here; the README is the single source. If the README's install steps ever go stale, fix them there.

---

## npm run (steps)

```bash
npx ncu                                                 # 1. see what is outdated
npx ncu -u --target latest --cooldown 7 \
  --reject typescript,tailwindcss,tailwind-merge,next,eslint,eslint-config-next   # 2. bump everything NOT on the hold list
npx ncu -u --target minor --cooldown 7 \
  --filter next,eslint-config-next                       # 3. latest-minor for the pinned framework pair
npm install && npm update --before "$(date -d "7 days ago" -I)"  # 4. resolve + pull latest in-range (TS/Tailwind/ESLint move up within their major via their caret ranges)
npm audit                                                # 5. check
npm audit fix                                            # 6. transitive dev-chain fixes ONLY
```

**NEVER run `npm audit fix --force`.** Its "fix" for the postcss advisory is to downgrade Next to `9.3.3`, which is destructive nonsense. See the postcss trap below.

Verify gate:

```bash
npm run verify
```

### TRAP: postcss nested under Next

Next hard-pins an old `postcss` (e.g. `8.4.31`) as a direct dependency, so it nests its own copy that `npm audit fix` cannot reach and `--force` wants to "fix" by nuking Next. The correct, surgical fix is an override in `package.json` (already in place):

```json
"overrides": {
  "postcss": "^8.5.10"
}
```

postcss 8.4 -> 8.5 is a backward-compatible in-minor bump, so this is safe and makes Next dedupe onto the patched top-level copy. Bump the floor here whenever a new postcss advisory lands. Re-run `npm install`, then `npm audit` should report 0.

### TRAP: sharp nested under Next (same shape as postcss)

Next declares `sharp` as an **optionalDependency** (`^0.34.3` on 15.5.x), so the tree carries a copy Dependabot flags but cannot auto-PR. Its two attempted PRs for GHSA-f88m-g3jw-g9cj (2026-07-25, 2026-07-27) both **failed** — check `gh run list` for `npm_and_yarn in /. for sharp`, not `gh pr list`, or you will conclude nothing was ever raised. `npm audit fix --force` "fixes" it by downgrading Next to 14.2.35. Same nonsense as postcss, same surgical answer:

```json
"overrides": {
  "sharp": "^0.35.5"
}
```

Note this app never executes sharp: `next.config.ts` sets `output: "export"` with `images.unoptimized: true`, so the image optimizer is not built and the binary is not loaded. The override is lockfile hygiene to clear the alert, not a live exposure fix. Bump the floor when a new libvips advisory lands; drop it when Next's own pin moves past 0.35.

### TRAP: the eslint dev chain is stuck on minimatch 3.x

`npm audit` keeps reporting GHSA-g3hv-75wg-m249 (moderate) on `minimatch` 3.x and 10.x: the only fix is 11.0.1, a new major, reached through `eslint 9 -> @eslint/eslintrc + @eslint/config-array -> minimatch 3.x`. The `brace-expansion` 1.x copy under it does get backports (1.1.21 clears every listed advisory), so `npm update` keeps that one current.

**Do not override `minimatch` to a newer major.** With minimatch 10 `npm run lint` dies with `The requested module 'minimatch' does not provide an export named 'default'`: `@eslint/eslintrc` and `@eslint/config-array` do `import minimatch from "minimatch"`, and the newer majors have no default export. It clears when `eslint` 10 lands, which is on the hold list behind Next 16.

### TRAP: compression pinned exactly by serve

`serve` (the e2e static server) pins `compression` to exactly `1.8.1`, so GHSA-vc2v-76pw-4v95 (high, fixed in 1.8.2) cannot move without a `serve` release. No override against an exact parent pin. Exposure: dev only, `serve` hosts the local build on loopback for Playwright and never ships. Recheck each pass: `npm view serve dependencies.compression`.

---

## Cargo run (steps)

```bash
source "$HOME/.cargo/env"
cd src-tauri
cargo update                          # in-range refresh (respects Cargo.toml ranges); drops orphaned transitives
cargo update -p <crate>               # targeted, if an advisory needs one specific crate moved
cargo audit                           # RUSTSEC report; this is what Dependabot's Rust alerts mirror
cargo tree -i <crate>@<ver>           # find WHAT pulls a stuck vulnerable crate
```

Verify gate:

```bash
cargo build                           # compiles + links the app_lib; needs the Tauri Linux deps installed
```

`npm run tauri build` is the full release bundle (AppImage/deb/msi/dmg). It is heavy and CI does it on push to `main`; `cargo build` is enough to prove a dependency update compiles.

### TRAP: glib / gtk-rs is capped by Tauri 2.x

`glib` (and the whole `gtk`/`atk`/`webkit2gtk` 0.18 stack) is pulled transitively by Tauri 2.x and **cannot be forced to 0.20** while on Tauri 2.x. `cargo update -p glib --precise 0.20.0` will fail the resolver. The `glib` RUSTSEC advisory (medium, iterator unsoundness) resolves upstream when Tauri ships a release built on the gtk-rs 0.20 stack. Do not fight it. Leave it, note it in the baseline below, recheck each pass. Chasing an upstream-gated transitive advisory with no reachable patch is wasted effort.

`cargo audit` reports **0 vulnerabilities** here. It also lists `glib` as an `unsound` **warning** plus several `unmaintained` **warnings** (`unic-*` etc.) — all transitive via the gtk/Tauri stack. Dependabot does not alert on `unmaintained` advisories, only security vulnerabilities. Do not chase them; they are not ours to fix.

---

## Dependabot

- Security updates are on (public repo) and open PRs automatically.
- **A failed Dependabot run leaves NO PR and NO alert change**, so `gh pr list` looks clean while alerts stay open. Always cross-check `gh api repos/ph33nx/lila-player/dependabot/alerts` and `gh run list` before concluding there is nothing to do. Both `sharp` and `glib` are in this state: no reachable auto-fix, so every run fails silently.
- `.github/workflows/dependabot-auto-merge.yml` auto-merges **patch + minor** Dependabot PRs after CI passes, but only once the repo setting "Allow auto-merge" is on. While it is off the job fails with `Auto merge is not allowed for this repository` and the PR stays open with green CI.
- **An auto-merged PR does not trigger `publish.yml`.** Merges made with `GITHUB_TOKEN` cannot start another workflow, so no release is cut and `eslint-config-next` silently drifts off the `next` version it must match. Re-align it on the next manual pass.
- `.github/dependabot.yml` keeps version updates off (`open-pull-requests-limit: 0`) and ignores the hold-list majors with `versions` ranges, the only ignore form security updates respect. A security PR that proposes a held major (tailwindcss 4 for `postcss-selector-parser`): close it; the ignore stops it reopening.
- Dependabot PRs that this maintenance run already fixes on `main` auto-close as resolved. No need to merge them by hand.

---

## Baseline

**Held on their current major on purpose:** typescript 5.x · tailwindcss 3.x · tailwind-merge 2.x · next 15.5.x · eslint 9.x · eslint-config-next = next.

**Residual, upstream-gated, do not chase:** `glib` 0.18.5 RUSTSEC unsoundness, capped by Tauri 2.x on gtk-rs 0.18 (re-proved on tauri 2.12.5: `cargo update -p glib --precise 0.20.0` fails at `gtk v0.18.2 <- tauri`); recheck when Tauri releases on gtk-rs 0.20. `minimatch` 3.x and `compression` 1.8.1: the two npm traps above.

**Last pass (v1.1.1 + security sweep):** next and eslint-config-next 15.5.28 · react/react-dom 19.3.1 · vite 8.3.5 · vitest 5.0.5 · undici 8.12.3 · sharp override floor 0.35.5 · motion 13.5 (replaces the legacy `framer-motion` package; imports are `motion/react`) · everything else `npm update --before <7 days ago>`; Cargo: `cargo update -p tokio --precise 1.54.1` only (Cargo has no release-age filter, so a cooldown pass moves just the advisory crate). Not taken, majors outside the hold list: motion 14.
