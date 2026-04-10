# Architecture Overview

This document describes the intended structural boundaries for Bunlet.

It exists to keep milestone work aligned with a stable architecture instead of letting feature code define the architecture by accident.

## Layers

Bunlet has four primary layers:

1. Application code
2. `bunlet` public TypeScript API
3. Native runtime backend
4. CLI build/package/publish toolchain

## Package Responsibilities

### `packages/bunlet`

Owns the public API surface and orchestration logic.

Responsibilities:

- App lifecycle API
- Window and web contents abstractions
- IPC routing and renderer bridge
- Session abstractions
- Runtime backend selection and capability exposure
- Public config types

Non-responsibilities:

- Platform-specific windowing implementation
- Packaging and release artifact creation
- Backend-specific feature branching spread across the public API

### `packages/bunlet-native`

Owns the system-webview backend implementation.

Responsibilities:

- Native event loop integration
- Tao/wry window and webview creation
- Native IPC bridge
- Platform-specific API implementations

Non-responsibilities:

- Public API policy
- CLI workflow
- Packaging strategy

### `packages/bunlet-cef` and `packages/bunlet-cef-native`

Own the CEF backend implementation.

Responsibilities:

- Implement the same core runtime contract as the system-webview backend
- Report capability gaps explicitly during the parity ramp-up

Non-responsibilities:

- Defining an alternate public API
- Permanent fallback dependency on `@bunlet/native` for core behavior

### `packages/bunlet-cli`

Owns developer workflow and artifact production.

Responsibilities:

- Shared config loading
- Dev workflow
- Build output generation
- Packaging and publishing orchestration
- Artifact metadata generation

Non-responsibilities:

- Native runtime feature implementation
- Public runtime behavior

## Core Contracts

The following contracts should remain explicit and versioned in practice even if they are internal modules.

### Runtime Backend

The runtime backend contract defines:

- engine selection
- capability reporting
- window lifecycle operations
- script execution support
- devtools support
- session/cookie support

All backend-specific code should sit behind this contract.

### Window Manager

The window manager owns:

- window registration and lookup
- process-wide focused window lookup
- future native event synchronization
- future lifecycle coordination with sessions and IPC

`BrowserWindow` should not be the owner of process-wide window state.

### IPC Router

The IPC router owns:

- transport envelope parsing
- handler registration
- validation
- response/error formatting
- main-to-renderer messaging policy

### Session Model

The session model should be partition-based rather than window-ID based.

Target behavior:

- multiple windows can share one session partition
- cookie and storage behavior belongs to a session profile
- window creation chooses a session/profile explicitly

### Artifact Manifest

The artifact manifest should become the shared contract between:

- `build`
- `package`
- `publish`
- `auto-updater`

That manifest should describe the files, runtime, metadata, hashes, and packaging inputs produced for a release.

## Current Direction

The repo is moving toward this structure in phases:

- shared CLI config loading
- runtime backend boundary in `packages/bunlet`
- window manager ownership instead of direct global registry access
- native runtime split into state, IPC, and event-loop modules in `@bunlet/native`

## Decision Records

Architecture decisions are tracked in [`adrs/`](./adrs/README.md).

## Source Of Truth

The canonical documentation tree is [`docs/`](../index.md). The legacy `documentation/` tree is deprecated and should not receive new content.
