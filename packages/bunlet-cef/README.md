# @bunlet/cef

> Chromium Embedded Framework (CEF) backend for Bunlet — full Chromium 146+ runtime as an alternative to system WebView.

[![npm version](https://img.shields.io/npm/v/@bunlet/cef)](https://www.npmjs.com/package/@bunlet/cef)
[![crates.io](https://img.shields.io/crates/v/bunlet-cef-native)](https://crates.io/crates/bunlet-cef-native)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/dipankar/bunlet/blob/main/LICENSE)

This package replaces Bunlet's default system WebView with an embedded Chromium runtime. Install it when you need consistent rendering across platforms, full DevTools, complete cookie access, or `executeJavaScript` that returns values.

## Should I use CEF or system WebView?

| Choose **System WebView** (default) | Choose **CEF** (this package) |
|---|---|
| App size matters (20–40MB) | Pixel-perfect cross-platform rendering |
| Simple UI without complex CSS | Advanced CSS (Container Queries, `:has()`, subgrid) |
| Low memory / fast startup priority | Porting an existing web app |
| Standard desktop app | Full Chrome DevTools needed |
| Users have modern OS / browsers | `executeJavaScript` return values required |
| | `getCookies()` / full cookie management |
| | Consistent Web API surface across platforms |

## Size trade-off

| | System WebView | With @bunlet/cef |
|---|---|---|
| Added to bundle | 0MB | ~100MB |
| Total app size | 20–40MB | 120–150MB |
| Installer (.dmg/.msi/.AppImage) | 20–40MB | 100–150MB |
| Memory (idle, 1 window) | <50MB | <150MB |

The CEF backend roughly triples your app size. It's the right trade-off for complex apps; for simple UIs and most use cases, system WebView is the better default.

## Install

```bash
bun add @bunlet/cef
```

## Usage

To switch to the CEF backend, set the engine in your `bunlet.config.ts`:

```typescript
import { defineConfig } from '@bunlet/core/config';

export default defineConfig({
  webview: {
    engine: 'cef',
    cef: {
      cachePath: './cef-cache',
      remoteDebuggingPort: 9222,
    },
  },
});
```

Or set the environment variable:

```bash
BUNLET_ENGINE=cef bun run dev
```

## Feature parity: what CEF unlocks

These APIs are limited or unavailable on system WebView but fully supported with CEF:

| Capability | System WebView | CEF Backend |
|---|---|---|
| Window management & multi-window | Yes | Yes |
| IPC invoke & push | Yes | Yes |
| `executeJavaScript` | Fire-and-forget only | **Returns result** |
| `getCookies()` / cookie access | Returns `[]` | **Full read/write/delete** |
| `getURL()` / `getTitle()` | Tracking-based | **Native queries** |
| `canGoBack()` / `canGoForward()` | Tracking-based | **Native queries** |
| `getUserAgent()` | Throws error | **Supported** |
| `setUserAgent()` | Window creation only | **Anytime** |
| `flushStore()` | Throws error | **Supported** |
| DevTools — Network panel | Limited | **Full** |
| DevTools — Performance | Limited | **Full** |
| DevTools — Memory / Lighthouse | No | **Yes** |
| Remote debugging | No | **Yes** |
| Spell checker | No | **Supported** |

## DevTools access

To open Chrome DevTools with the CEF backend:

```bash
# Set a remote debugging port in config
cef: { remoteDebuggingPort: 9222 }
```

Then open `chrome://inspect` in any Chrome browser and connect to `localhost:9222`. You get the full Chrome DevTools — Elements, Console, Network, Performance, Memory, and Lighthouse panels.

To open DevTools programmatically:

```typescript
win.webContents.openDevTools();
```

## Platform support

| Platform | Architecture | Status |
|----------|--------------|--------|
| macOS | x64 | Beta |
| Linux | x64 | Beta |
| Windows | x64 | In Progress |

## CEF version

This package embeds **Chromium 146+** via the [`cef`](https://crates.io/crates/cef) and [`cef-dll-sys`](https://crates.io/crates/cef-dll-sys) crates from the Tauri team's CEF Rust bindings. The Chromium version is pinned at build time — your app's rendering is consistent regardless of the user's OS.

## Troubleshooting

### `Error: CEF helper process not found`

The `bunlet-cef-helper` binary (or `bunlet-cef-helper.exe` on Windows) must be in the same directory as your main executable. When installed via npm, it is included automatically. If consuming the crate directly, copy the helper binary from the build output.

### `Error: CEF failed to initialize`

On Linux, ensure the required system libraries are installed:

```bash
sudo apt install libgtk-3-dev libwebkit2gtk-4.1-dev libnss3 libatk-bridge2.0-0 libdrm2 libxkbcommon0 libgbm1 libasound2
```

### `Sandbox conflicts on Linux`

If CEF fails with sandbox-related errors, disable the sandbox in your config:

```typescript
cef: { disableSandbox: true }
```

Or build the native crate without the sandbox feature.

### `CEF adds too much to my app size`

If you don't need the full Chromium runtime, remove this package — Bunlet defaults to system WebView with no size overhead. You only need `@bunlet/cef` when system WebView doesn't meet your requirements.

## Related packages

- [@bunlet/core](https://www.npmjs.com/package/@bunlet/core) — required base runtime for every Bunlet app
- [@bunlet/native](https://www.npmjs.com/package/@bunlet/native) — system WebView backend (default, no extra size)
- [@bunlet/cli](https://www.npmjs.com/package/@bunlet/cli) — scaffold, build, and package your app
- [bunlet-cef-native](https://crates.io/crates/bunlet-cef-native) — Rust crate this package consumes
- [Bunlet on GitHub](https://github.com/dipankar/bunlet) — source and contribution guide

## License

MIT — see [LICENSE](https://github.com/dipankar/bunlet/blob/main/LICENSE) for details.
