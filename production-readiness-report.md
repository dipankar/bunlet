# Bunlet Production-Readiness Report

_Generated 2026-05-19. Branch: `chore/production-readiness`._

This report assesses how close `@bunlet/core` is to a production-ready 1.0
based on a hands-on pass: local macOS verification + the existing test
suite + a new smoke harness + a new CLI scaffold-and-build roundtrip +
CEF brought out of `continue-on-error`.

**TL;DR:** macOS is green and shippable for v0.2 use cases. Linux and
Windows green-ness depend on the CI run that opens with this PR — that
matrix has historically been the source of breakage and the last five
`main` commits were CI-fix commits. Several "framework" gaps (auto-updater,
code signing, packager installers) remain blockers for a 1.0 claim.

## Verdict matrix

| Area                 | macOS | Linux¹ | Windows¹ | Notes |
|----------------------|:-----:|:------:|:--------:|-------|
| Core windowing       |  ✓    |  ?     |  ?       | tao+wry. Linux center() known broken (screen API). |
| IPC (Zod-validated)  |  ✓    |  ?     |  ?       | All unit + integration tests pass. |
| Native APIs          |  ✓    |  ?     |  ?       | dialog, menu, tray, clipboard, shortcuts, notifications, power. Tests mock native — see "Gaps". |
| CLI create + build   |  ✓    |  ?     |  ?       | New roundtrip test gated on `BUNLET_CLI_ROUNDTRIP=1`. |
| Smoke (examples)     |  6/6 + skip notes-app |  ?  |  ?  | New `bun run smoke` harness. |
| Packaging (installer)|  ⚠    |  ⚠     |  ⚠       | `cli package` exists but produces no real DMG/MSI/AppImage in CI yet. |
| CEF backend          |  ✓²   |  ?     |  ?       | Built locally with `CARGO_TARGET_DIR` workaround. Now ungated in CI. |
| Auto-updater         |  ✗    |  ✗     |  ✗       | Only unit-tested with mocks; no E2E. |
| Doctor coverage      |  ✓    |  ✓     |  ✓       | Now checks WebView2 / MSVC / Xcode CLT / xvfb / disk / CEF. |

¹ Pending CI run on this PR. Will be filled in once the matrix completes.
² CEF: requires `CARGO_TARGET_DIR` redirect when building locally on the
  small `/Volumes/Github` volume (~6 GB target dir). CI runners have room.

## What this PR adds

1. **`scripts/doctor.ts`** — six new checks: Windows WebView2 runtime,
   C/C++ toolchain (Xcode CLT / MSVC / cc), Linux `xvfb-run` availability,
   CEF artifact presence, disk-space (warn under 2 GB), with new
   `warn`/`info` severity levels so optional items don't fail the run.

2. **`scripts/smoke.ts`** (NEW, `bun run smoke`) — spawns each example for
   a 4 s window, captures stdout/stderr, matches against a fatal-error
   pattern set (`panicked`, `SIGSEGV`, `Cannot find module`, …), then
   SIGTERMs and verifies clean exit. Skips when no DISPLAY/WAYLAND on
   Linux. Wired into CI under `xvfb-run`.

3. **`packages/bunlet/src/native-binding.smoke.test.ts`** (NEW) — the
   first test in the repo that loads the real Rust `.node` addon (no
   `mock.module('./runtime')`). Verifies the platform binary exists with
   the correct filename and exposes `initApp`, `createWindow`,
   `closeWindow`, `runEventLoop`.

4. **`packages/bunlet-cli/src/cli.roundtrip.test.ts`** (NEW, gated on
   `BUNLET_CLI_ROUNDTRIP=1`) — scaffolds a fresh app inside a temp dir
   under the monorepo (so workspace symlinks resolve), runs
   `buildCommand` programmatically, asserts `dist/main.js` and
   `dist/package.json` materialize. Negative-case asserts unknown webview
   engine raises cleanly.

5. **Scaffold fixes** — found by running the roundtrip test:
   - `packages/bunlet-cli/src/commands/create.ts`: generated apps had
     `"dependencies": { "bunlet": "^…" }` (no such npm package) and
     `import { defineConfig } from 'bunlet/config'`. The published name
     is `@bunlet/core`. Every newly scaffolded app would fail at
     `bun install` and again at config load. **Fixed.**
   - `packages/bunlet/src/debug.ts`: stale `'bunlet/debug'` doc import,
     fixed for consistency.

6. **`packages/bunlet-cef/scripts/copy-artifact.js`** — silently failed
   when `CARGO_TARGET_DIR` was set (it hardcoded the relative target
   path). Now honors the env var. Surfaced while building CEF locally
   with a redirected target dir to escape the 100%-full data volume.

7. **`.github/workflows/ci.yml`** — wired in the smoke harness, the
   roundtrip test (via `BUNLET_CLI_ROUNDTRIP=1`), and a post-build
   `bun run doctor` gate. Removed `continue-on-error: true` from the CEF
   build step so CEF failures now break CI (the user's explicit ask:
   promote CEF from optional to required).

## v1.0 blockers (ordered by criticality)

1. **Auto-updater E2E**. `packages/bunlet/src/auto-updater.ts` exists with
   platform-specific install strategies, but its `*.test.ts` is all
   mocks. No update has ever been downloaded, verified, or installed by
   the CI pipeline on any platform. Shipping a 1.0 with this untested
   means users can't be auto-updated, which is a deal-breaker for many
   desktop apps.

2. **Linux Screen API broken**. README acknowledges: GTK/D-Bus conflicts
   with TAO's event loop, so display enumeration hangs. Consequence:
   `window.center()` is unavailable on Linux. Workaround documented but
   not in-app. Fix requires re-architecting display detection (probably
   via TAO's screen primitives directly, or a background process).

3. **Packaging installers**. `cli package` runs a placeholder in the CI
   release workflow today (`echo "Would run: bun run bunlet package …"`).
   No actual DMG, MSI, or AppImage is produced or tested. `cli package`
   needs to be wired up to real `electron-builder`-equivalent tooling
   per platform.

4. **Code signing + notarization**. Not implemented in `cli package`.
   Unsigned apps trigger Gatekeeper on macOS and SmartScreen on Windows.
   Required for any non-dev distribution.

5. **`ERR_NOT_IMPLEMENTED` paths** still in production code:
   - `menu.ts`: app menu reconstruction from native ID; context menu
     dismissal.
   - `power-monitor.ts`: thermal state monitoring.
   - `session.ts`: spell checking (two callsites).
   Document these as platform limitations or implement.

6. **JS ↔ Rust window state drift**. README: "Native-originated window
   and navigation sync is still being tightened for full parity." Means
   user-driven OS interactions (move, resize from titlebar drag, native
   close) may not reflect in JS state synchronously. Needs concrete
   tests once the sync model is finalized.

## Acceptable-for-0.2 known issues (document, don't block)

- `bunlet-native` copy-artifact.js doesn't honor `CARGO_TARGET_DIR`
  (matches the CEF bug pattern; lower priority because CI never
  redirects the bunlet-native target).
- `notes-app` example requires a separate Vite renderer; smoke harness
  skips it without `BUNLET_SMOKE_FULL=1`.
- No multi-display / DPI scaling tests.
- No accessibility-tree assertions on any platform.
- `bunlet-cef-native` target dir is ~6 GB when built; small CI runners
  may struggle if cache size budget is tight.
- CLI roundtrip test scaffolds the fixture under `tmp-roundtrip-*` in
  the monorepo root so symlink resolution works. Cleaned up via
  `afterAll`. `.gitignore` updated.

## Verification log

Local macOS (Darwin 25.4.0, arm64, Bun 1.3.11, rustc 1.95.0):

```
$ bun run doctor                       # all required ✓, info-only items expected
$ bun run typecheck                    # bunlet + bunlet-cli  ✓
$ bun run lint                         # oxlint                ✓
$ BUNLET_CLI_ROUNDTRIP=1 bun test     # 308 pass, 0 fail, 28 files, 489 ms
$ bun run smoke                        # 6/6 pass, 1 skip (notes-app)
$ cd packages/bunlet-cef && bun run build   # ✓ via CARGO_TARGET_DIR redirect
```

CI (this PR): _pending — will be appended once the matrix completes._

## Recommendation

This branch is safe to merge as a foundation pass: it fixes two real
scaffold bugs that break every new user, surfaces and remediates the
CEF copy-artifact bug, adds the first real native-binding smoke test
and the first CLI scaffold-to-build roundtrip test, and brings CEF
under the same CI gating as bunlet-native.

It does **not** make Bunlet 1.0-ready. The blocker list above is what
should drive the v0.3/v0.4 work — particularly auto-updater E2E and
real packaging output. Recommend tagging this `v0.2.0-rc.1` after the
matrix is green and treating the blocker list as the 1.0 milestone.
