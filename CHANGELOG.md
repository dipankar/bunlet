# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.2] - 2026-05-20

Second republish for the v0.2 line. v0.2.1's npm publish failed
because Node 22 ships npm 10.x, which can sign provenance via OIDC but
cannot exchange the OIDC token for an npm publish credential — npm OIDC
trusted publishing requires **npm >= 11.5.1**. Symptom in v0.2.1 was a
confusing `404 Not Found` after a successful sigstore attestation.

### Fixed

- **release(npm):** add an explicit `npm install -g npm@latest` step
  after `actions/setup-node@v4` so the publish job uses npm 11.x
  regardless of the bundled Node LTS version.

## [0.2.1] - 2026-05-20

Republish release for v0.2.0. No code changes — only the release
workflow's publish steps had to be fixed:

### Fixed

- **release(cargo):** add `--no-verify` to `cargo publish` for both
  `bunlet-native` and `bunlet-cef-native`. The default verify-build
  failed on Ubuntu without gtk/glib/webkit2gtk system deps. The
  build-native matrix already verifies on real targets, so the
  redundant Linux-only verify build was the only thing blocking
  publish.
- **release(npm):** switch from a long-lived `NPM_TOKEN` secret to
  npm's OIDC trusted-publishing flow. Drops the `Configure npm
  authentication` step; `npm publish --provenance` exchanges the
  GitHub OIDC token for a scoped npm token automatically.
  **Setup required**: per-package "Trusted Publisher" config on
  npmjs.com pointing at `github.com/dipankar/bunlet` and
  `.github/workflows/release.yml`.

## [0.2.0] - 2026-05-20

The v1.0-blocker release. Closes the production-readiness gap list from
`production-readiness-report.md` and brings every cell in the verdict
matrix to ✓ (or ⚠ with documented rationale) across macOS, Linux, and
Windows in CI.

### Added

- **Window state sync.** `BrowserWindowState` now tracks `focused`,
  `minimized`, `maximized`, `fullscreen`, and `visible` in addition to
  `title` / `bounds`. Native window events update the cache and
  user-driven `maximize()` / `minimize()` / `show()` / `hide()` /
  `setFullScreen()` update it optimistically. `isFocused()` /
  `isMinimized()` / etc. now read from the cache — fixes
  `Missing native implementation: isWindowFocused` on cross-backend
  paths.
- **Linux screen API**: cached primary display via `OnceCell`, primed at
  app-ready inside the GTK-safe window. Subsequent
  `screen.getPrimaryDisplay` calls return cached data, sidestepping
  the GDK re-entrancy hang. `BrowserWindow.center()` warns instead of
  throwing when the cache is cold.
- **`Menu.getApplicationMenu`**: returns the stored `Menu` via a static
  registry. No longer throws `ERR_NOT_IMPLEMENTED`.
- **`Menu.closePopup`**: best-effort no-op that delegates to
  `native.closeContextMenu` if exposed; safe to call regardless.
- **Power-monitor thermal state**: real per-OS readings — `pmset -g
  therm` on macOS, `/sys/class/thermal/thermal_zone*/temp` on Linux,
  `MSAcpi_ThermalZoneTemperature` via PowerShell WMI on Windows. Falls
  back to `nominal` on any read failure.
- **Session spell-check**: `isSpellCheckerEnabled` / `setSpellCheckerEnabled`
  are now session-local booleans (default on). Custom dictionaries are
  v1.1.
- **macOS notarization**: new `notarizeDarwinApp()` wraps
  `xcrun notarytool submit --wait` + `xcrun stapler staple`, reading
  credentials from `NotarizeOptions` or env vars (`APPLE_ID`,
  `APPLE_TEAM_ID`, `APPLE_APP_SPECIFIC_PASSWORD`) with a clean
  missing-credential error.
- **Linux GPG signing**: new `signAppImage()` wraps `gpg --detach-sign
  --armor` to produce `.AppImage.sig` sidecars.
- **`docs/packaging/signing.md`**: full guide for code-signing +
  notarization + GPG signing on all three platforms.
- **Auto-updater integration test**
  (`packages/bunlet/src/auto-updater.integration.test.ts`): spins up a
  local `Bun.serve()` fixture, exercises check → download → sha512
  verify against real bytes. Gated `BUNLET_UPDATER_E2E=1`.
- **Native binding smoke test**
  (`packages/bunlet/src/native-binding.smoke.test.ts`): the first test
  in the repo that loads the real Rust `.node` addon (no
  `mock.module('./runtime')`).
- **CLI roundtrip test**
  (`packages/bunlet-cli/src/cli.roundtrip.test.ts`): scaffolds a fresh
  app, runs `buildCommand` programmatically, asserts `dist/main.js`
  and `dist/package.json` materialize. Gated
  `BUNLET_CLI_ROUNDTRIP=1`; runs in every CI OS.
- **`scripts/smoke.ts`** (`bun run smoke`): spawns every example for 4s
  under SIGTERM control, scans stdout/stderr for fatal-error markers,
  exits non-zero on any panic. Wired into the test job under
  `xvfb-run` on Linux.
- **`scripts/doctor.ts`** new checks: Windows WebView2 runtime, MSVC
  toolchain via `vswhere`, macOS Xcode CLT, Linux `xvfb-run` (warn),
  disk-space (warn under 2 GB), CEF artifact presence. Added
  `warn`/`info` severity levels so optional items don't break the run.
- Initial public release pipeline with automated CI/CD for macOS,
  Linux, and Windows.
- OIDC-based provenance attestation for npm packages.
- crates.io publishing for `bunlet-native` and `bunlet-cef-native`.
- Package-level READMEs with SEO optimization for all published crates
  and packages.
- GitHub artifact attestation for all release binaries.

### Changed

- **`Cargo.lock` committed** for both `bunlet-native` and
  `bunlet-cef-native`. Without this, CI silently resolved newer minor
  versions (e.g. `cef 146.7` while source targeted `146.5`) and broke
  Linux + Windows builds.
- **CEF promoted out of `continue-on-error`** in `.github/workflows/ci.yml`.
  Failures now break CI on all 3 OS.
- **`cef` and `cef-dll-sys` pinned to `=146.5`**. `on_pre_key_event`
  signature is cfg-gated per platform (`*mut u8` on macOS,
  `Option<&mut _XEvent>` on Linux, `Option<&mut tagMSG>` on Windows).
- **`bunlet-cef/scripts/copy-artifact.js`** now honors `CARGO_TARGET_DIR`
  (previously hardcoded the relative path; silently failed when the
  target dir was redirected).
- **`bunlet-cef-native`** gained `gtk = "0.18"` as a Linux-target dep
  (`lib.rs` references `gtk::events_pending` under
  `cfg(target_os = "linux")`).

### Fixed

- **Generated apps could never `bun install`.** `bunlet-cli`'s
  `create.ts` template put `"dependencies": { "bunlet": "^..." }` —
  no such npm package exists. Now `"@bunlet/core"`.
- **Generated apps could never load their config.** Same template had
  `import { defineConfig } from 'bunlet/config'`. Fixed to
  `@bunlet/core/config`.
- **`packages/bunlet/src/debug.ts`** stale `'bunlet/debug'` doc import,
  fixed for consistency.
- **`ci`**: call app internal methods directly in integration tests
  (test-ordering fix on Ubuntu Bun test runner).
- **`ci`**: resolve Windows Send trait and Ubuntu test isolation.
- **`ci`**: add native build to test job; fix Linux/Windows native
  compilation.
- **`ci`**: resolve module imports and add Linux build dependencies.

### Known limitations (deferred to v1.1)

- Real Apple notarization run in CI — needs Apple Developer account
  + secrets.
- Full Chromium custom-dictionary spell-check (3–5k LOC per backend).
- Auto-updater E2E with real binary replacement (would need a sandbox
  runner; current integration test stops before `quitAndInstall`).
- `cli package` is real but the release workflow doesn't yet call it
  on tag push.
- `Menu.popup()` itself is not yet implemented; `closePopup` is a safe
  no-op for now.

## [0.1.0] - 2026-05-10

### Added

- Core desktop framework with Bun and WebView.
- Cross-platform native window management via Tao.
- WebView rendering via WRY (WebKit on macOS, WebView2 on Windows, WebKitGTK on Linux).
- Type-safe IPC with Zod validation.
- Native OS APIs: file dialogs, menus, system tray, notifications, clipboard, global shortcuts, file watcher, power monitor.
- `@bunlet/cli` with `create`, `dev`, `build`, and `package` commands.
- CEF (Chromium Embedded Framework) backend as an optional alternative WebView engine.
- 7 example applications demonstrating real-world usage.
