# Dependency Maintenance

Periodic dependency + security upkeep for Lila Player. Run every 4-8 weeks, or whenever Dependabot opens alerts. Written for an agent picking this up cold.

**Two package managers, kept in lockstep:**

| Ecosystem | Manifest | Lockfile | Refresh tool | Advisory tool |
|---|---|---|---|---|
| npm (frontend) | `package.json` | `package-lock.json` | `npm-check-updates` (`ncu`) | `npm audit` |
| Cargo (Tauri backend) | `src-tauri/Cargo.toml` | `src-tauri/Cargo.lock` | `cargo update` | `cargo audit` |

**Done means all of these are green (the gate, never skip):**

```bash
npm run typecheck && npm run lint && npm run build     # npm side
(cd src-tauri && cargo build)                          # Rust side
```

Plus the lefthook hooks must keep passing: `pre-commit` runs `format` + `lint --fix`, `pre-push` runs `typecheck` (`lefthook.yml`). If the gate above passes, the hooks pass.

---

## Hold list (do NOT bump these to their latest major)

Bumping any of these is a deliberate, separate migration, not part of a routine pass. Keep them on the latest **minor/patch within the current major**.

| Package | Pin to | Why held |
|---|---|---|
| `typescript` | 5.x | 6/7 are the native-compiler majors; migrate on purpose, not in a sweep |
| `tailwindcss` | 3.x | v4 is a CSS-first rewrite (`@import "tailwindcss"`, `@theme`, `@tailwindcss/postcss`, HSL format changes). Big surface for a small app. |
| `tailwind-merge` | 2.x | v3 **drops Tailwind v3 support**. Tied to `tailwindcss` — move both together or neither. |
| `next` | 15.x | v16 removes `next lint` (already warns), changes Turbopack defaults. Do the codemod migration deliberately. |
| `eslint` | 9.x | ESLint 10 tooling tracks Next 16. Keep with Next. |
| `eslint-config-next` | = `next` version | Always matches the Next version exactly (`15.5.x`). |

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
npx ncu -u --target latest \
  --reject typescript,tailwindcss,tailwind-merge,next,eslint,eslint-config-next   # 2. bump everything NOT on the hold list
npx ncu -u --target minor \
  --filter next,eslint-config-next                       # 3. latest-minor for the pinned framework pair
npm install && npm update                                # 4. resolve + pull latest in-range (TS/Tailwind/ESLint move up within their major via their caret ranges)
npm audit                                                # 5. check
npm audit fix                                            # 6. transitive dev-chain fixes ONLY
```

**NEVER run `npm audit fix --force`.** Its "fix" for the postcss advisory is to downgrade Next to `9.3.3`, which is destructive nonsense. See the postcss trap below.

Verify gate:

```bash
npm run typecheck && npm run lint && npm run build
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
  "sharp": "^0.35.3"
}
```

Note this app never executes sharp: `next.config.ts` sets `output: "export"` with `images.unoptimized: true`, so the image optimizer is not built and the binary is not loaded. The override is lockfile hygiene to clear the alert, not a live exposure fix. Bump the floor when a new libvips advisory lands; drop it when Next's own pin moves past 0.35.

### TRAP: the eslint dev chain is stuck on brace-expansion 1.x

`npm audit` reports 9 high that will NOT go away. All of them are one advisory, GHSA-mh99-v99m-4gvg (`brace-expansion` <= 5.0.7, unbounded expansion length -> OOM), reached through `eslint 9 -> @eslint/eslintrc + @eslint/config-array -> minimatch 3.x -> brace-expansion 1.x`. The other 8 rows are just parents inheriting it.

**There is no fix on the 1.x line.** The maintainer backports per major line (1.1.16 and 2.1.2 shipped the same day for the earlier GHSA-3jxr-9vmj-r5cp), but 5.0.8 shipped alone. Verified by reading the tarballs: 5.0.8 adds `EXPANSION_MAX_LENGTH` (4M chars); 1.1.16 has only the `max` count cap and no length bound. The GitHub range is unbounded below, so 1.1.16 is genuinely in range, not a false positive.

**Do not try to override `minimatch` to 10.x.** Tried 2026-07-28: `npm audit` goes to 0, typecheck and build stay green, and `npm run lint` dies with `The requested module 'minimatch' does not provide an export named 'default'`. `@eslint/eslintrc/lib/config-array/override-tester.js` and `@eslint/config-array/dist/esm/index.js` both do `import minimatch from "minimatch"`, and minimatch 10's ESM build has no default export. The vulnerable path is the incompatible path; there is nothing to scope around.

Upstream-gated exactly like `glib` below: it clears when `eslint` 10 lands, which is on the hold list behind Next 16. Leave it, recheck each pass. What you CAN keep current is the 5.x copy under `@typescript-eslint/typescript-estree` (`npm update brace-expansion`); that one is in range and moves for free.

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
- `.github/workflows/dependabot-auto-merge.yml` auto-merges **patch + minor** Dependabot PRs after CI passes.
- **An auto-merged PR does not trigger `publish.yml`.** Merges made with `GITHUB_TOKEN` cannot start another workflow, so no release is cut and `eslint-config-next` silently drifts off the `next` version it must match. Re-align it on the next manual pass.
- There is **no `.github/dependabot.yml`**, so only *security* updates get PRs, not routine version updates. Adding one (ecosystems `npm` + `cargo` + `github-actions`, weekly) would automate most of a routine pass and pair with the existing auto-merge. Consider it.
- Dependabot PRs that this maintenance run already fixes on `main` auto-close as resolved. No need to merge them by hand.

---

## Baseline: last run 2026-07-28

Security-only pass. Routine drift was cleared 2026-07-21 and was not re-swept.

**Resolved:**
- `sharp` 0.34.5 -> **0.35.3** via override (GHSA-f88m-g3jw-g9cj, libvips CVE-2026-33327/33328/35590/35591, high). Closes the only actionable open alert. See the sharp trap above.
- `brace-expansion` 5.0.7 -> 5.0.8 under `@typescript-eslint/typescript-estree` (in range, free).
- `eslint-config-next` 15.5.20 -> **15.5.21**, re-aligned to `next` after the auto-merged Dependabot PR moved only one side of the pair.

**Residual (expected, upstream-gated, do not chase):**
- `glib` 0.18.5 — RUSTSEC unsoundness warning, capped by Tauri 2.x gtk-rs 0.18. Re-proved 2026-07-28: `cargo update -p glib --precise 0.20.0` fails at `gtk v0.18.2 <- tauri v2.11.5`. Recheck when Tauri releases on gtk-rs 0.20.
- `brace-expansion` 1.x — 9 high in `npm audit`, all one advisory through eslint 9's internals, no fix published on the 1.x line. See the eslint trap above. Clears with eslint 10, which is held behind Next 16.

**Key resolved versions (held on their current major on purpose):**
- typescript 5.9.3 · tailwindcss 3.4.19 · tailwind-merge 2.6.1 · next 15.5.21 · eslint 9.39.5 · eslint-config-next 15.5.21
- Freely upgraded: react/react-dom 19.2.7 · next-themes 0.4.6 · framer-motion 12.42.2 · lucide-react 1.25.0 · @radix-ui/\* latest · @tauri-apps/\* 2.11.x · postcss 8.5.20

Gates green: typecheck, lint, `next build`, `cargo audit` (0 vulnerabilities, 17 allowed warnings). `cargo build` not re-run: no Rust manifest or lockfile change in this pass.
