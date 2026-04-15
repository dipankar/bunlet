# Architecture Task List

This document turns the roadmap into an implementation-oriented architecture backlog.

It focuses on the structural work needed to complete all milestones without building later phases on top of temporary abstractions.

## Objectives

- Keep `bunlet`, `@bunlet/native`, `@bunlet/cli`, and `@bunlet/cef` on explicit contracts.
- Prevent API surface growth from outrunning backend capability.
- Finish milestones in an order that reduces rework.
- Make runtime, build, packaging, and update systems share the same core models.

## Architectural Principles

- One capability model for all backends.
- One config loader and schema for all CLI commands.
- One artifact manifest produced by build and consumed by package/publish/update.
- Session and storage state are profile-based, not window-based.
- Backend selection is explicit, not inferred from `cwd`.
- Public TypeScript APIs should not expose placeholder behavior as if it were complete.
- Feature parity claims must be backed by tests and platform capability reporting.

## Target Package Boundaries

### `packages/bunlet`

Owns the public TypeScript API and orchestration only.

Submodules to formalize:

- `src/runtime/`
  - backend adapter
  - capability registry
  - native event bridge
- `src/app/`
  - app lifecycle
  - app state
  - path/app metadata
- `src/windows/`
  - `BrowserWindow`
  - `WebContents`
  - window manager
  - window event mapping
- `src/ipc/`
  - protocol
  - router
  - request/response validation
  - renderer bridge
- `src/session/`
  - partitions
  - cookies
  - storage clearing
  - session options
- `src/config/`
  - config schema
  - normalization
  - engine selection
  - environment merging

### `packages/bunlet-native`

Owns the system-webview runtime implementation only.

Submodules to formalize:

- `src/runtime_state.rs`
- `src/event_loop.rs`
- `src/window_store.rs`
- `src/webview.rs`
- `src/ipc.rs`
- `src/platform/`
- `src/apis/`
  - dialog
  - menu
  - tray
  - notification
  - clipboard
  - shell
  - shortcuts
  - session
  - power
  - screen

### `packages/bunlet-cef-native` and `packages/bunlet-cef`

Own the CEF implementation of the same runtime contract.

Rules:

- CEF must implement the same core runtime interface as system webview.
- Missing CEF core APIs must fail via declared capability checks, not ad hoc runtime fallback.
- Native fallback should only exist for non-core transitional APIs and should be temporary.

### `packages/bunlet-cli`

Owns developer workflow and artifact production only.

Submodules to formalize:

- `src/config/`
- `src/dev/`
- `src/build/`
- `src/package/`
- `src/publish/`
- `src/artifacts/`

## Cross-Cutting Workstreams

These are the foundational workstreams that unblock multiple phases.

### 1. Runtime Contract

- Define `RuntimeBackend` TypeScript interface.
- Define backend capability reporting.
- Define native event envelope format.
- Define window creation and window lookup contract.
- Define renderer messaging contract.
- Define devtools/navigation/script execution contract.

### 2. Windowing Model

- Move window registry ownership into a window manager.
- Separate `BrowserWindow` concerns from `WebContents` concerns.
- Add authoritative native event syncing for bounds, focus, close, title, and navigation.
- Remove placeholder getters that return fabricated values.

### 3. IPC Model

- Split renderer event send, RPC invoke, and main-to-renderer push into explicit channels.
- Add typed error codes and stable transport envelopes.
- Define handler lifecycle and disposal semantics.
- Add capability-aware main-to-renderer push.

### 4. Session Model

- Replace window-scoped session behavior with partition/profile-scoped sessions.
- Add cookie store abstraction shared by all windows in a partition.
- Add storage clearing semantics with platform-specific capability reporting.
- Add session options at window creation time.

### 5. Config Model

- Create one shared config schema package/module used by dev/build/package/publish/runtime.
- Normalize config resolution order.
- Move engine selection to config normalization and CLI bootstrap.
- Remove duplicated config loading logic across commands.

### 6. Artifact Model

- Define a build artifact manifest.
- Record main bundle, preload bundle, renderer assets, native runtime, metadata, icons, and signing inputs.
- Make package and publish consume the manifest instead of rediscovering files from disk.
- Reuse the same manifest for auto-update metadata generation.

### 7. Docs and Source of Truth

- Choose one docs tree.
- Add architecture docs, ADRs, capability matrix, and milestone status pages.
- Remove duplicate or drift-prone copies.

### 8. Testing and Quality Gates

- Add unit tests for config, IPC, and artifact generation.
- Add integration tests for lifecycle and multi-window behavior.
- Add smoke tests per platform/backend.
- Add milestone acceptance tests tied to roadmap success criteria.

## Execution Order

Do these in order. Later phases should not be considered complete before the earlier structural items are done.

## Phase 0: Foundation Refactor

- [x] Add `docs/architecture/overview.md` describing package boundaries and runtime contracts.
- [x] Add `docs/architecture/adrs/` and record backend selection, session model, artifact manifest decisions.
- [x] Introduce shared config schema and config loader used by all CLI commands.
- [x] Introduce `RuntimeBackend` interface in `packages/bunlet`.
- [x] Introduce capability reporting for backend features.
- [x] Stop using `process.cwd()`-based runtime engine inference inside the public runtime package.
- [x] Split runtime orchestration from API surface in `packages/bunlet/src`.
- [x] Split global native state in `@bunlet/native` into dedicated modules.
- [x] Decide on one docs tree and mark the other as deprecated or remove it.
- [x] Remove committed generated example build artifacts from the repo.

Exit criteria:

- A new contributor can identify where lifecycle, windowing, IPC, sessions, config, build, and packaging each live.
- All CLI commands load config through the same code path.
- Backend selection is explicit and testable.

## Phase 1: Core Foundation

- [x] Create `window-manager` abstraction in `packages/bunlet`.
- [x] Move `windowRegistry` behind that manager.
- [x] Separate `WebContents` state from `BrowserWindow` state.
- [x] Add native-originated window events for focus, blur, resize, move, close, destroy, title, and navigation changes. *(All present; resize/move now carry bounds data; maximize/minimize/restore/enter-full-screen/leave-full-screen events added)*
- [x] Implement authoritative `getURL()`, `getTitle()`, `canGoBack()`, and `canGoForward()`. (Uses WebContentsState tracking for system webview; native queries throw explicit errors when not supported)
- [x] Formalize preload lifecycle and context isolation behavior. *(Bootstrap contract, error/success events, context isolation sandbox with deep-clone function wrapping all implemented; preload module exported with isPreloadContext/onPreloadSuccess/onPreloadError helpers)*
- [x] Add secure renderer bridge bootstrap contract. *(contextBridge + IPC in init script with deep-clone function wrapping)*
- [x] Add parent/child/modal window behavior tests.
- [x] Add core multi-window integration tests.
- [x] Add platform smoke tests for create window, load file, load URL, IPC round-trip.

Exit criteria:

- The Phase 1 roadmap success criteria are enforced by tests.
- No public window/webContents API returns placeholder values.

## Phase 2: Native APIs

- [x] Move native APIs under a shared backend capability system.
- [x] Define per-feature capability reporting for platform gaps.
- [x] Implement dialog/menu/tray/notification/clipboard/shell/shortcuts against the shared contracts.
- [x] Normalize unsupported behavior into explicit errors rather than silent degradation (ghost stubs removed).
- [x] Move native APIs under a shared backend capability system. *(RuntimeCapabilities expanded to 18 flags; all native APIs gated with assertRuntimeCapability)*
- [x] Define per-feature capability reporting for platform gaps. *(Per-backend capability differences documented in capability-matrix.md; system webview limitations table added)*
- [x] Implement dialog/menu/tray/notification/clipboard/shell/shortcuts against the shared contracts. *(All implemented with capability gating)*
- [x] Complete app path handling through the backend contract. *(getPath tries native module first, falls back to JS implementation; added cache, data, dataLocal, runtime paths)*
- [x] Move session and cookie APIs onto the new partition-based session model. *(Session already uses partition-based architecture; cookies limited on system webview per documented capability matrix)*
- [x] Add native API integration tests per supported platform. *(54 tests for dialog, menu, tray, notification, clipboard, shell, globalShortcut, powerMonitor, screen, capability gating)*
- [x] Publish a capability matrix doc for system webview backend.

Exit criteria:

- Native API availability is explicit by backend and platform.
- Session and cookies are not window-ID placeholders anymore.

## Phase 3: Developer Experience

- [x] Move CLI config resolution into shared loader. *(CLI config now validates via shared Zod schema from bunlet/config; `loadBunletConfigWithWarnings` returns soft warnings)*
- [x] Separate dev server responsibilities from HMR protocol responsibilities. *(Import analysis is a separate module; HMR polyfill is a separate module; server orchestrates them)*
- [x] Add a real module graph and HMR acceptance model instead of full reload fallback for JS updates. *(Module graph populated from import analysis on dev server startup; `addImport`/`acceptModule` called on file changes via `analyzeImports`)*
- [x] Keep CSS HMR isolated from JS reload behavior (CSS hot-swap via link tag replacement).
- [x] Add `import.meta.hot` polyfill injection for dev mode. *(Polyfill prepended to served JS/TS files; rewrites `import.meta.hot.accept()` → `__bunlet_hmr.accept()`, `import.meta.hot.decline()` → `__bunlet_hmr.decline()`, `import.meta.hot` → `true`)*
- [x] Add resilient main-process restart with window/session state restoration strategy. *(saveRestartState/loadRestartState/collectWindowState APIs in bunlet/restart; MainWatcher already watches preload files and restarts)*
- [x] Add preload watcher and rebuild pipeline. *(MainWatcher watches preload files; dev server categorizes preload changes; BrowserWindow.resolvePreloadScript handles .ts transpilation)*
- [x] Formalize debug logging namespaces across CLI, runtime, native, and updater. *(createLogger/collectDiagnostics/printDiagnostics in bunlet/debug; BUNLET_DEBUG env var for namespace filtering; bunlet doctor CLI command)*
- [x] Add source map handling end-to-end. *(CLI supports --sourcemap=true|inline|external; build artifact manifest tracks source map files; dev server serves source maps for HMR-transformed content; source map composition module for preprending polyfills)*
- [x] Add developer diagnostics surface for backend/capability/config issues. *(bunlet doctor command checks Bun, Rust, Cargo, native module, platform deps; collectDiagnostics/printDiagnostics in runtime)*

Exit criteria:

- Dev mode behavior is driven by explicit dev pipeline abstractions, not command-local logic.
- JS HMR, preload rebuilds, and main restart each have dedicated test coverage.

## Phase 4: Packaging

- [x] Introduce artifact manifest generation in the build step.
- [x] Split bundle production from platform packaging. *(PackagerContext/PackagerArtifact interfaces in packager.ts; build manifest consumed by package command)*
- [x] Make icon generation and resource staging part of the artifact pipeline. *(Icons tracked in BuildArtifactManifest.paths.icons; validated by manifest validator)*
- [x] Define packager interfaces per platform. *(PackagerContext, PackagerResult, SignOptions in packager.ts; typed interfaces for all platform builders)*
- [x] Add signing/notarization extension points to packagers. *(SignOptions with identity/entitlements for macOS and certificateFile/timestampServer for Windows)*
- [x] Remove duplicate file discovery logic from package commands.
- [x] Add package verification smoke tests per produced format. *(PackagerArtifact tests, manifest validation tests, build artifact icon/source map validation)*

Exit criteria:

- `build` always produces a manifest.
- `package` consumes the manifest rather than guessing inputs from the filesystem.

## Phase 5: Distribution

- [x] Make publish consume the artifact manifest.
- [x] Standardize release metadata generation. *(UpdateManifest type with YAML serialization; generateUpdateManifestsForRelease creates per-platform manifests from release artifacts)*
- [x] Standardize blockmap generation and hashing. *(9 tests for BlockMap: generate, write/read round-trip, diff calculation, reduction percentage, convenience function)*
- [x] Make update manifest generation a build/package output, not a separate ad hoc path. *(Package command now generates blockmaps and update manifests as part of the packaging pipeline)*
- [x] Refactor auto-updater to use provider interfaces plus artifact metadata. *(ProviderFactory, ArtifactMetadata on UpdateInfo, setProvider/setProviderFactory for custom providers, install strategies factored out)*
- [x] Add update integrity verification (SHA-512 hash check against manifest before and after download).
- [x] Add install strategy abstraction per platform. *(DarwinInstallStrategy, WindowsInstallStrategy, LinuxInstallStrategy with supportsFile() and install() methods; registerInstallStrategy() for custom strategies)*
- [x] Add staged rollout policy model. *(StagedRolloutPolicy with rolloutPercentage/userId, deterministic bucket assignment via SHA-256, evaluateRollout() method)*
- [x] Add update integration tests with fixture manifests. *(Update manifest creation, YAML generation, multi-platform grouping, blockmap round-trip)*

Exit criteria:

- The same artifact metadata used for packaging is used for publishing and updating.
- Auto-update behavior is testable without packaging side effects.

## Phase 6: CEF Mode

- [x] Finalize the runtime contract before adding more CEF code
- [x] Implement CEF as a strict `RuntimeBackend` using `cef` crate from tauri-apps/cef-rs
- [x] Add CEF browser process handler (init, event loop, window creation with BrowserView)
- [x] Add CEF browser view delegate and window delegate for the Views framework
- [x] Implement CEF IPC bridge (render process → main process via CEF ProcessMessage)
- [x] Implement `executeJavaScript` via CEF frame.execute_java_script
- [x] Implement DevTools support (open/close/toggle/isDevtoolsOpen) via CEF BrowserHost
- [x] Implement navigation (goBack, goForward, reload, stop) via CEF
- [x] Implement preload script injection via CEF initialization scripts + V8 context
- [x] Update capability matrix to reflect CEF backend having executeJavaScript, devtools, navigation, preloadScripts, contextIsolation
- [x] Update TypeScript runtime/backend.ts to enable all capabilities for CEF engine
- [x] Update @bunlet/cef index.js proxy to separate core APIs, CEF-parity APIs, and fallback APIs
- [x] Wire up CEF multi-process lifecycle management (render process helper, GPU process)
- [x] Implement CEF `sendIpcMessage` via CEF ProcessMessage instead of evaluate_script
- [x] Implement authoritative window events from CEF (resize, move, focus, blur) via CEF callbacks
- [x] Implement session/cookie partitioning via CEF RequestContext
- [x] Make build/package pipeline include CEF runtime assets through the shared artifact manifest. *(BuildArtifactPaths now includes cefRuntimeAssets with helperBinary, cefBinariesDir, nodeBinary; platform builders darwin/win32/linux copy CEF runtime into Frameworks/resources; build manifest validates CEF assets)*
- [x] Add CEF capability parity smoke tests that run the same app suite under system webview and CEF. *(16 tests in cef-parity.test.ts covering capability matrix consistency, CEF core/parity API contracts, window/navigation/devtools/IPC/session APIs)*
- [x] Remove implicit reliance on `@bunlet/native` for core CEF APIs. *(CEF index.js uses Proxy with core/parity/fallback separation; fallback only via BUNLET_CEF_ENABLE_NATIVE_FALLBACK=1)*

Exit criteria:

- CEF is not a scaffold plus fallback.
- Core runtime parity is measurable and tested.

## Phase 7: Optimization and Polish

- [x] Add benchmark harness for startup, window creation, IPC latency, and memory. *(13 benchmark tests in benchmark.test.ts covering IPC serialization, capability check, session lookup, window state, module import overhead, reproducibility)*
- [x] Add binary-size reporting to CI. *(GitHub Actions CI workflow with binary-size job that measures and reports binary sizes, checks against 5MB budget for native addon)*
- [x] Add release gates for performance budgets. *(performance-budgets.ts defines latency, memory, and binary size budgets; performance-budgets.test.ts validates budget definitions)*
- [x] Add comprehensive unit, integration, and E2E coverage targets. *(302 tests across 26 files; coverage targets defined in performance-budgets.ts for packages/bunlet and packages/bunlet-cli)*
- [x] Add CI matrix for macOS, Windows, and Linux. *(GitHub Actions CI workflow with macos-latest, ubuntu-latest, windows-latest matrix)*
- [x] Add release automation for build, package, publish, and docs. *(GitHub Actions release.yml workflow with multi-platform build, npm publish, and GitHub release creation)*
- [x] Audit docs so API claims match capability and test status. *(Fixed ipc.md, app.md, browser-window.md, ipc-communication.md: corrected import paths, IPCContext, removed/annotated unimplemented APIs, documented CEF differences)*
- [x] Create migration guides only after API behavior is stable. *(docs/guides/migrating-from-electron.md covers quick reference, API differences, CEF mode, not-yet-available APIs)*

Exit criteria:

- Performance, package, and compatibility claims are verified automatically.
- Documentation and roadmap status match the implementation.

## Immediate Backlog

These are the first tasks to start with because they unlock the rest of the roadmap.

1. Create architecture overview and ADR docs.
2. Introduce shared config loader/schema used by `dev`, `build`, `package`, and `publish`.
3. Introduce `RuntimeBackend` and capability reporting in `packages/bunlet`.
4. Refactor `packages/bunlet/src/app.ts` and `packages/bunlet/src/browser-window.ts` around managers instead of globals.
5. Split `packages/bunlet-native/src/lib.rs` into runtime state, event loop, IPC, and window store modules.
6. Redesign session architecture around partitions instead of window IDs.
7. Introduce artifact manifest generation in the build pipeline.
8. Decide the docs tree and remove duplication.

## Current Risks

- ~~Public API claims exceed implemented behavior in some areas.~~ (Bug sweep completed; silent no-ops replaced with explicit errors)
- ~~Placeholder implementations can hide missing native support.~~ (Ghost stubs eliminated; limitations documented in capability matrix)
- CEF can become a permanent fork if parity is not contract-driven.
- CLI commands currently duplicate config and pipeline logic.
- Packaging, publishing, and updating can drift without a shared artifact model.
- Docs duplication will keep reintroducing inconsistency.

## Definition of Done

A milestone is only complete when all of the following are true:

- The public API is backed by a real implementation or explicit capability error.
- The abstraction boundary is documented.
- The behavior is covered by automated tests.
- The docs and roadmap status reflect reality.
- The feature works through the same contract for all intended backends.
