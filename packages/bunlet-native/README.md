# @bunlet/native

> Rust native bindings for the Bunlet desktop framework — cross-platform WebView, window management, and OS-level APIs via NAPI-RS.

[![npm version](https://img.shields.io/npm/v/@bunlet/native)](https://www.npmjs.com/package/@bunlet/native)
[![crates.io](https://img.shields.io/crates/v/bunlet-native)](https://crates.io/crates/bunlet-native)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/dipankar/bunlet/blob/main/LICENSE)

Powers the system WebView backend for Bunlet. This package is a low-level NAPI-RS native module — **you probably don't need to install it directly.**

If you are building a Bunlet desktop app, install `@bunlet/core` instead, which depends on this package transitively and provides the high-level TypeScript API (`app`, `BrowserWindow`, IPC, menus, dialogs, etc.).

Install `@bunlet/native` directly only if you are writing your own TypeScript bindings layer over the native WebView runtime.

## Install

```bash
bun add @bunlet/native
```

Requires **Rust >= 1.70** to compile from source. Prebuilt binaries are available for all supported platforms.

## Architecture

```
Your Application
  └── @bunlet/core (TypeScript API — app, BrowserWindow, IPC, menus, dialogs...)
        └── @bunlet/native (this package — NAPI-RS FFI layer)
              ├── tao (cross-platform window management)
              │     ├── NSWindow (macOS)
              │     ├── HWND (Windows)
              │     └── GTK Window (Linux)
              └── wry (cross-platform WebView rendering)
                    ├── WKWebView (macOS)
                    ├── WebView2 (Windows)
                    └── WebKitGTK (Linux)
```

## Usage

To create a window directly with the native module (bypassing the `@bunlet/core` abstraction):

```typescript
import { createWindow, runEventLoop, quitApp } from '@bunlet/native';

const handle = createWindow({
  title: 'Direct Native Window',
  width: 800,
  height: 600,
  url: 'https://example.com',
});

runEventLoop();
```

To show a file open dialog:

```typescript
import { showOpenDialog } from '@bunlet/native';

const result = showOpenDialog({
  title: 'Select a file',
  filters: [{ name: 'Images', extensions: ['png', 'jpg'] }],
});

console.log(result.filePath);
```

Most apps should use `@bunlet/core` for the full Electron-compatible API rather than calling these native functions directly.

## NAPI exports

| Function | Description |
|---|---|
| `createWindow(options)` | Create a native window with WebView |
| `destroyWindow(handle)` | Destroy a window |
| `runEventLoop()` | Start the platform event loop (blocking) |
| `quitApp()` | Gracefully quit the application |
| `showOpenDialog(options)` | Native file open dialog |
| `showSaveDialog(options)` | Native file save dialog |
| `showMessageBox(options)` | Native message box |
| `createTray(icon, tooltip)` | Create a system tray icon |
| `sendNotification(options)` | Desktop notification |
| `registerGlobalShortcut(key, callback)` | Global keyboard shortcut |
| `clipboardWrite(text)` | Write to system clipboard |
| `clipboardRead()` | Read from system clipboard |
| `shellOpen(path)` | Open file/URL in system handler |
| `watchPath(path, recursive)` | Watch file system changes |
| `getBatteryInfo()` | Power/battery information |

## Platform support

| Platform | Architecture | Engine | Prerequisites | Status |
|----------|--------------|--------|---------------|--------|
| macOS | arm64 | WKWebView | Xcode CLT | Stable |
| macOS | x64 | WKWebView | Xcode CLT | Stable |
| Windows | x64 | WebView2 | WebView2 Runtime | Stable |
| Linux | x64 | WebKitGTK 4.1 | `libwebkit2gtk-4.1-dev`, `libgtk-3-dev` | Stable |
| Linux | arm64 | WebKitGTK 4.1 | `libwebkit2gtk-4.1-dev`, `libgtk-3-dev` | Stable |

### Installing prerequisites

**macOS:**

```bash
xcode-select --install
```

**Linux (Ubuntu/Debian):**

```bash
sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev
```

**Linux (Fedora):**

```bash
sudo dnf install webkit2gtk4.1-devel gtk3-devel
```

**Linux (Arch):**

```bash
sudo pacman -S webkit2gtk-4.1 gtk3
```

**Windows:** [WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (pre-installed on Windows 11).

## Build

```bash
cargo build --release
bun run scripts/copy-artifact.js
```

Release builds use LTO, single codegen unit, `opt-level = "z"`, and symbol stripping. The resulting `.node` binary is typically under 5MB.

## Known limitations (system WebView)

| API | Limitation |
|---|---|
| `executeJavaScript` | Fire-and-forget only; cannot return values. Use IPC for round-trips. |
| `getCookies()` | Always returns `[]`; wry cannot read cookie results. |
| `getUserAgent()` | Cannot return values; throws explicit error. |
| `setUserAgent()` | Must be set during window creation, not after. |
| `getURL()` / `getTitle()` | Uses internal state tracking, not native queries. |
| `canGoBack()` / `canGoForward()` | Uses internal state tracking. |
| screen API on Linux | GTK event loop conflicts may use fallback values for display enumeration. |

For full cookie access, `executeJavaScript` return values, and consistent rendering across platforms, use the [@bunlet/cef](https://www.npmjs.com/package/@bunlet/cef) Chromium backend.

## Related packages

- [@bunlet/core](https://www.npmjs.com/package/@bunlet/core) — high-level TypeScript API (use this to build apps)
- [@bunlet/cef](https://www.npmjs.com/package/@bunlet/cef) — optional Chromium backend (full cookie/JS access)
- [@bunlet/cli](https://www.npmjs.com/package/@bunlet/cli) — scaffold, dev, build, and package commands
- [bunlet-native](https://crates.io/crates/bunlet-native) — this crate on crates.io
- [tao](https://crates.io/crates/tao) — upstream window management
- [wry](https://crates.io/crates/wry) — upstream WebView rendering

## License

MIT — see [LICENSE](https://github.com/dipankar/bunlet/blob/main/LICENSE) for details.
