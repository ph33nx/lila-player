# Release

Lila ships from one static export in two ways — a Tauri desktop bundle and a GitHub Pages web app. Both are driven by pushes to `main`.

## Versioning

The version is defined once, in `package.json`. `src-tauri/tauri.conf.json` sets `"version": "../package.json"`, which Tauri's config loader resolves relative to the config file, so the bundle, the release tag and the page's JSON-LD all read the same value. Bump with `npm version <x.y.z> --no-git-tag-version` (updates the lockfile too). `src-tauri/Cargo.toml` carries its own `version` for Cargo's sake; Tauri ignores it while the config defines one, so it only needs to match at a release.

## `.github/workflows/publish.yml`

Runs on every push to `main` and on `v*` tags (plus manual dispatch). Builds and publishes a GitHub release tagged `v<version>` (the `package.json` version, through `tauri.conf.json`), with bundles per platform from the workflow's build matrix: macOS Intel + Apple Silicon (`.dmg`), Ubuntu (`.AppImage`/`.deb`/`.rpm`), Windows (`.msi`/`.exe`). A push to `main` with no version bump re-publishes the release for the existing tag rather than cutting a new one.

Unsigned binaries: see the README's Installation FAQ — don't duplicate that note here.

## `.github/workflows/deploy-pages.yml`

Runs on push to `main`. Builds the same static export with `PAGES_BASE_PATH` (from `actions/configure-pages`'s output) set as an env var, which Next turns into `basePath`. Next rewrites the URLs it emits itself; the app has no runtime asset loads, see docs/architecture.md before adding one.

## `.github/workflows/dependabot-auto-merge.yml`

Auto-merges Dependabot PRs classified patch or minor, once CI passes. These merges run under `GITHUB_TOKEN`, which cannot trigger other workflows — so an auto-merge does not fire `publish.yml`, and `eslint-config-next` (which must track `next` exactly) can silently drift out of alignment. Re-align it on the next manual dependency pass; see docs/dependencies.md.

## `.github/workflows/ci.yml`

Gate for PRs and pushes to `main`: `npm run verify` (typecheck, lint, unit tests, build) then Playwright e2e. A branch ruleset on `main` requires the `check` status from this workflow before merge (admin bypass allowed).

## Release checklist

1. `npm version <x.y.z> --no-git-tag-version`, and set the same value in `src-tauri/Cargo.toml`.
2. Run `npm run verify` and `(cd src-tauri && cargo build)`.
3. Push to `main` (directly, or via a PR that passes the `check` ruleset).
4. Confirm `publish.yml` succeeded for every matrix platform: `gh run list --workflow publish.yml`.
5. Confirm the GitHub release is tagged `v<version>` with all expected bundles attached.
6. Confirm `deploy-pages.yml` succeeded and the Pages site serves the new build.
