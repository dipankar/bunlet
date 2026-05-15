# bunlet-cef-native

> Native CEF (Chromium Embedded Framework) bindings for the Bunlet desktop framework — full Chromium 146+ runtime as an alternative to system WebView.

[![crates.io](https://img.shields.io/crates/v/bunlet-cef-native)](https://crates.io/crates/bunlet-cef-native)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/dipankar/bunlet/blob/main/LICENSE)

Cross-platform desktop app native bindings using Chromium Embedded Framework and NAPI-RS. This is the Rust crate that powers the `@bunlet/cef` npm package.

**If you are building a Bunlet app**, install `@bunlet/cef` from npm instead — that package consumes this crate and provides the TypeScript API.

## Platform Support

| Platform | Target Triple | Status |
|----------|--------------|--------|
| macOS (x64) | `x86_64-apple-darwin` | Beta |
| Linux (x64) | `x86_64-unknown-linux-gnu` | Beta |
| Windows (x64) | `x86_64-pc-windows-msvc` | In Progress |

## Prerequisites

- **Rust** >= 1.70 ([rustup](https://rustup.rs))
- **macOS**: Xcode Command Line Tools (`xcode-select --install`)
- **Linux**: `sudo apt install libgtk-3-dev libwebkit2gtk-4.1-dev`
- **Windows**: Visual Studio Build Tools with C++ workload

## Architecture

```
Your App
  └── @bunlet/core (TypeScript runtime)
        └── @bunlet/cef (npm package)
              └── bunlet-cef-native (this crate, NAPI-RS)
                    └── cef / cef-dll-sys (Chromium 146+, from tauri-apps/cef-rs)
                          └── Chromium Embedded Framework
```

## Install

```bash
cargo add bunlet-cef-native
```

## Build

```bash
cargo build --release
```

Release builds use LTO, single codegen unit, `opt-level = "z"`, and symbol stripping for minimum binary size.

## Rust API

This crate exports NAPI-RS functions consumable from Bun and Node.js:

```rust
use napi_derive::napi;

#[napi]
pub fn cef_initialize(options: CefOptions) -> napi::Result<()>;

#[napi]
pub fn cef_create_browser(config: BrowserConfig) -> napi::Result<BrowserHandle>;

#[napi]
pub fn cef_close_browser(handle: BrowserHandle) -> napi::Result<()>;

#[napi]
pub fn cef_do_message_loop_work();
```

## Cargo Features

| Feature | Default | Description |
|---------|---------|-------------|
| `default` | Yes | Standard CEF backend |
| `sandbox` | No | Enable Chromium sandboxing (recommended for production) |

Enable sandbox with:

```toml
[dependencies]
bunlet-cef-native = { version = "0.1", features = ["sandbox"] }
```

## Helper Binary

This crate includes a **`bunlet-cef-helper`** binary that runs as a CEF subprocess for GPU rendering, networking, and utility tasks. It must be shipped alongside your main executable.

When using `@bunlet/cef` via npm, the helper is included automatically. When consuming this crate directly, ensure the compiled `bunlet-cef-helper` binary (or `bunlet-cef-helper.exe` on Windows) is in the same directory as your application binary.

## Related Packages

- [@bunlet/cef](https://www.npmjs.com/package/@bunlet/cef) — npm package that consumes this crate (recommended for Bunlet apps)
- [bunlet-native](https://crates.io/crates/bunlet-native) — system WebView alternative on crates.io (smaller, uses OS WebView)
- [@bunlet/core](https://www.npmjs.com/package/@bunlet/core) — main Bunlet runtime on npm
- [cef](https://crates.io/crates/cef) — CEF Rust bindings from the Tauri team
- [cef-dll-sys](https://crates.io/crates/cef-dll-sys) — CEF DLL system bindings

## License

MIT — see [LICENSE](https://github.com/dipankar/bunlet/blob/main/LICENSE) for details.
