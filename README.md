# Bunlet

> Build desktop apps with Bun

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![npm version](https://img.shields.io/npm/v/bunlet.svg)](https://www.npmjs.com/package/bunlet)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Platforms](https://img.shields.io/badge/platforms-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)](#)
[![Bun](https://img.shields.io/badge/Bun-%3E%3D1.0-orange.svg)](https://bun.sh/)

Bunlet is a modern desktop application framework that combines the speed of [Bun](https://bun.sh) with native WebView rendering. Create cross-platform desktop apps with TypeScript while keeping installers small and memory usage low.

## Why Bunlet?

| Feature | Bunlet | Electron | Tauri |
|---------|--------|----------|-------|
| **Runtime** | Bun | Node.js | None (Rust) |
| **WebView** | System + CEF | Chromium (bundled) | System only |
| **Installer Size** | 20-40MB | 80-150MB | 2-10MB |
| **Language** | TypeScript | JavaScript | Rust + JS |
| **Memory Usage** | Low | High | Very Low |
| **Learning Curve** | Easy (Electron-like API) | Easy | Moderate (Rust) |

### Key Advantages

- **Familiar API** - If you know Electron, you know Bunlet
- **Flexible Rendering** - Choose System WebView (small) or CEF (consistent)
- **TypeScript-First** - Full type safety out of the box
- **Fast Development** - Hot reload, DevTools, instant rebuilds
- **Production Ready** - Code signing, auto-updates, installers

## Quick Start

```bash
# Install Bunlet CLI globally
bun add -g @bunlet/cli

# Create a new application
bunlet create my-app

# Navigate to project
cd my-app

# Start development server
bunlet dev
```

Your app opens automatically with hot reload enabled!

## Example Application

```typescript
// src/main.ts
import { app, BrowserWindow } from 'bunlet';

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'My Bunlet App',
    webPreferences: {
      preload: './preload.ts',
    },
  });

  win.loadFile('index.html');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
```

```typescript
// src/preload.ts
import { contextBridge, ipcRenderer } from 'bunlet/renderer';

contextBridge.exposeInMainWorld('api', {
  readFile: (path: string) => ipcRenderer.invoke('fs:read', { path }),
  platform: process.platform,
});
```

## Features

### Core
- **Window Management** - Create, customize, and control application windows
- **IPC System** - Type-safe communication between main and renderer processes
- **Preload Scripts** - Secure context bridge for exposing APIs

### Native APIs
- **Dialog** - Native file open/save dialogs, message boxes
- **Menu** - Application menus and context menus
- **Tray** - System tray icons with menus
- **Notifications** - Desktop notifications
- **Clipboard** - Read/write system clipboard
- **Shell** - Open URLs, files, folders with system apps
- **Global Shortcuts** - System-wide keyboard shortcuts

### Developer Experience
- **Hot Reload** - Instant updates during development
- **DevTools** - Built-in Chrome DevTools integration
- **TypeScript** - First-class TypeScript support
- **Source Maps** - Debug your original code

### Packaging
- **Cross-Platform** - Build for Windows, macOS, and Linux
- **Installers** - DMG, MSI, NSIS, AppImage, deb, rpm
- **Code Signing** - Sign for macOS and Windows
- **Auto-Updates** - Built-in update mechanism

## WebView Modes

Bunlet supports two WebView backends:

### System WebView (Default)
Uses the operating system's native WebView:
- **Windows**: WebView2 (Edge/Chromium)
- **macOS**: WKWebView (Safari/WebKit)
- **Linux**: WebKitGTK

**Pros**: Small installers (20-40MB), uses familiar browser engine
**Cons**: Rendering may vary slightly across platforms

### CEF Mode (Optional)
Bundles Chromium Embedded Framework:

```bash
bun add @bunlet/cef
```

```typescript
// bunlet.config.ts
import { defineConfig } from 'bunlet/config';

export default defineConfig({
  webview: {
    engine: 'cef',
  },
});
```

**Pros**: Dedicated backend path, consistent API surface for CEF runtime
**Cons**: Experimental scaffold (renderer wiring in progress), larger installers (100MB+)

## CLI Commands

```bash
bunlet create <app-name>   # Create new project
bunlet dev                 # Start dev server with HMR
bunlet build               # Build for production
bunlet package             # Create distributable installers
```

See [CLI Documentation](./documentation/docs/cli/overview.md) for all options.

## Configuration

```typescript
// bunlet.config.ts
import { defineConfig } from 'bunlet/config';

export default defineConfig({
  appId: 'com.example.myapp',
  productName: 'My App',
  version: '1.0.0',

  main: './src/main.ts',
  preload: './src/preload.ts',
  renderer: {
    entry: './src/renderer/index.html',
  },

  webview: {
    engine: 'system', // or 'cef'
  },

  mac: {
    icon: './resources/icon.icns',
    hardenedRuntime: true,
  },

  win: {
    icon: './resources/icon.ico',
  },

  linux: {
    icon: './resources/icons',
    category: 'Development',
  },

  updater: {
    provider: 'github',
    owner: 'your-org',
    repo: 'your-app',
  },
});
```

## Size Optimization

Bunlet provides multiple strategies to minimize installer size:

| Strategy | Impact | Effort |
|----------|--------|--------|
| Use System WebView | -60MB | Default |
| Enable minification | -10-30% | `bunlet build --minify` |
| Strip debug symbols | -5-15% | `bunlet build --strip-symbols` |
| Bytecode compilation | -10% | `bunlet build --bytecode` |
| Compress installer | -30-50% | `--compression lzma` |
| Audit dependencies | Varies | Manual review |

**Target sizes:**
- Standard build: **25-35MB**
- Aggressive optimization: **15-20MB**

See the documentation for details.

## Documentation

Full documentation is available in the [`documentation/`](./documentation) directory.

- [Getting Started](./documentation/docs/getting-started/installation.md)
- [Guides](./documentation/docs/guides/)
- [API Reference](./documentation/docs/api/)
- [CLI Reference](./documentation/docs/cli/)

## Roadmap

See [ROADMAP.md](ROADMAP.md) for the development timeline.

**Current Status**: Active Development

| Phase | Status |
|-------|--------|
| Core Foundation | In Progress |
| Native APIs | Planned |
| Developer Experience | Planned |
| Packaging | Planned |
| Distribution | Planned |
| CEF Mode | Scaffolded (Experimental) |

## Requirements

- **Bun** 1.0 or later
- **Operating Systems**:
  - Windows 10/11 (x64)
  - macOS 10.15+ (x64, ARM64)
  - Linux (x64, ARM64) - requires WebKitGTK

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.

---

**Built with [Bun](https://bun.sh)** - the fast all-in-one JavaScript runtime.
