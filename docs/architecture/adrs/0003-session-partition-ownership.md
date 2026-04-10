# ADR 0003: Session Partition Ownership

## Context

The original session implementation treated a session as if it were owned by one window ID.

That creates the wrong architecture for:

- shared browser state across multiple windows
- future persistent session partitions
- future session-aware window creation

It also makes the public `Session` abstraction weaker than the model described in the roadmap.

## Decision

Session ownership is partition-based.

Current transitional implementation:

- each `Session` represents a partition
- sessions track attached window IDs instead of one stored window ID
- `BrowserWindow` resolves its session from `webPreferences.session` or `webPreferences.partition`
- native session operations still execute through a representative attached window until backend-level partition support exists

## Consequences

Positive:

- public API now models shared session ownership more accurately
- multiple windows can attach to the same session object
- later native/backend partition support has a compatible TypeScript-side abstraction

Negative:

- native behavior is still limited by per-window backend APIs
- some session operations still rely on an attached window being available
