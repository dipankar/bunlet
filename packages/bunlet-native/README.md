# @bunlet/native

Rust native bindings for the Bunlet desktop framework. Powers the cross-platform WebView, window management, and OS-level APIs via NAPI-RS.

[![npm version](https://img.shields.io/npm/v/@bunlet/native)](https://www.npmjs.com/package/@bunlet/native)
[![crates.io](https://img.shields.io/crates/v/bunlet-native)](https://crates.io/crates/bunlet-native)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/dipankar/bunlet/blob/main/LICENSE)

## Features

- **Cross-platform WebView** — WebKit (macOS), WebView2 (Windows), WebKitGTK (Linux)
- **Window management** — Tao-based native windows with full control
- **Native OS APIs** — Dialogs, menus, tray icons, notifications, clipboard, shortcuts
- **NAPI-RS bindings** — Zero-cost FFI between Bun/Node.js and Rust
- **Small binary** — Aggressively optimized release builds under 5MB

## Supported Platforms

| Platform | Architecture | Status |
|----------|--------------|--------|
| macOS    | arm64        | ✅ Stable |
| macOS    | x64          | ✅ Stable |
| Linux    | x64          | ✅ Stable |
| Linux    | arm64        | ✅ Stable |
| Windows  | x64          | ✅ Stable |

## Architecture

This crate combines:

- **[Tao](https://github.com/tauri-apps/tao)** — Cross-platform window management
- **[WRY](https://github.com/tauri-apps/wry)** — Cross-platform WebView rendering
- **NAPI-RS** — Rust-to-JavaScript bindings for Bun and Node.js

## License

MIT — see [LICENSE](https://github.com/dipankar/bunlet/blob/main/LICENSE) for details.
