# bunlet

Build cross-platform desktop apps with Bun and WebView. A lightweight, fast alternative to Electron and Tauri.

[![npm version](https://img.shields.io/npm/v/bunlet)](https://www.npmjs.com/package/bunlet)
[![crates.io](https://img.shields.io/crates/v/bunlet-native)](https://crates.io/crates/bunlet-native)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/dipankar/bunlet/blob/main/LICENSE)

## Features

- **Lightweight** — Native WebView backed by system engines (WebKit on macOS, WebView2 on Windows, GTK WebKit on Linux)
- **Fast** — Powered by Bun's JavaScriptCore engine and Rust native bindings
- **Type-safe IPC** — Zod-validated message passing between main and renderer processes
- **Native APIs** — File dialogs, menus, system tray, notifications, clipboard, global shortcuts, and more
- **Hot reload** — Instant feedback during development
- **Small bundle size** — Under 5MB native addon budget

## Install

```bash
bun add bunlet
```

## Quick Start

```typescript
import { app, BrowserWindow } from 'bunlet';

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: './preload.ts'
    }
  });

  win.loadURL('https://bunlet.dev');
});
```

## Documentation

- [Getting Started](https://bunlet.dev/docs/getting-started)
- [API Reference](https://bunlet.dev/docs/api)
- [Packaging Guide](https://bunlet.dev/docs/packaging)

## License

MIT — see [LICENSE](https://github.com/dipankar/bunlet/blob/main/LICENSE) for details.
