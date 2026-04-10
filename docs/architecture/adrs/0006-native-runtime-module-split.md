# 0006 Native Runtime Module Split

## Context

`packages/bunlet-native/src/lib.rs` had become the shared dumping ground for native runtime state, IPC callbacks, event-loop ownership, and window creation. That made milestone work risky because unrelated changes to sessions, IPC, or lifecycle all met in one file.

## Decision

Split native runtime responsibilities into dedicated modules while keeping the exported N-API surface stable:

- `runtime_state.rs` owns shared window registries, pending window state, and file-server lifecycle
- `ipc.rs` owns native-to-JS IPC callback registration and message dispatch
- `event_loop.rs` owns event-loop initialization, pumping, and blocking run behavior
- `lib.rs` remains the crate entrypoint and keeps window/webview construction helpers that are shared by the runtime modules

## Consequences

The crate now has explicit seams for later extraction of window store, event synchronization, and capability reporting without rewriting the external JS bindings first.
