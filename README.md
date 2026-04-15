# Bunlet

> Build desktop apps with Bun

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Platforms](https://img.shields.io/badge/platforms-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)](#)
[![Bun](https://img.shields.io/badge/Bun-%3E%3D1.0-orange.svg)](https://bun.sh/)

Bunlet is a modern desktop application framework that combines the speed of [Bun](https://bun.sh) with native WebView rendering. Create cross-platform desktop apps with TypeScript while keeping installers small and memory usage low.

## Why Bunlet?

| Feature | Bunlet | Electron | Tauri |
|---------|--------|----------|-------|
| **Runtime** | Bun | Node.js | None (Rust) |
| **WebView** | System WebView | Chromium (bundled) | System WebView |
| **Installer Size** | ~20-40MB | 80-150MB | 2-10MB |
| **Language** | TypeScript | JavaScript | Rust + JS |
| **Memory Usage** | Low | High | Very Low |
| **Learning Curve** | Easy (Electron-like API) | Easy | Moderate |

### Key Advantages

- **Familiar API** - Electron-compatible API design
- **TypeScript-First** - Full type safety with Zod validation for IPC
- **Native Performance** - Rust backend with NAPI bindings
- **Cross-Platform** - Windows, macOS, and Linux support
- **Small Footprint** - Uses system WebView (no bundled Chromium)

## Quick Start

```bash
# Clone and set up everything in one command
git clone https://github.com/bunlet/bunlet.git
cd bunlet
bun run setup

# Verify your environment
bun run doctor

# Run an example
cd examples/hello-world
bun run main.ts
```

The `bun run setup` command installs dependencies, builds the Rust native module, and builds the TypeScript packages. See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed setup instructions.

## Example Application

```typescript
// main.ts
import { app, BrowserWindow, z } from 'bunlet';
import path from 'path';

// Register IPC handlers before app is ready
app.handle('greet', z.object({ name: z.string() }), async (params) => {
  return { message: `Hello, ${params.name}!` };
});

app.on('window-all-closed', () => {
  app.quit();
});

// Wait for app to be ready
await app.whenReady();

// Create a window
const win = new BrowserWindow({
  width: 800,
  height: 600,
  title: 'My Bunlet App',
});

win.loadFile(path.join(import.meta.dir, 'index.html'));

// Run the event loop
app.run();
```

```html
<!-- index.html -->
<!DOCTYPE html>
<html>
<body>
  <h1>Hello from Bunlet!</h1>
  <button onclick="greet()">Greet</button>
  <script>
    async function greet() {
      const result = await window.__bunlet.invoke({
        method: 'greet',
        params: { name: 'World' }
      });
      alert(result.message);
    }
  </script>
</body>
</html>
```

## Implemented Features

### Window Management
- Create and manage multiple windows
- Window properties: size, position, title, resizable, decorations
- Window state: minimize, maximize, fullscreen, show/hide
- Window events: close, resize, move, focus/blur
- Parent/child window relationships

### IPC System
- Type-safe IPC with Zod schema validation
- `app.handle()` for registering handlers
- `window.__bunlet.invoke()` for renderer-to-main calls
- `window.__bunlet.on()` for event subscriptions

### Native Dialogs
- Open file/folder dialogs with filters
- Save file dialogs
- Message boxes (info, warning, error, question)

### Menu System
- Application menus
- Context menus
- Menu items with click handlers, accelerators, checkboxes, radio buttons

### System Tray
- Tray icons with tooltips
- Tray context menus
- Click/double-click events

### Notifications
- Desktop notifications with title and body
- Notification click events
- Action buttons (platform-dependent)

### Clipboard
- Read/write text
- Read/write HTML
- Read/write images
- Clear clipboard

### Global Shortcuts
- Register system-wide keyboard shortcuts
- Unregister individual or all shortcuts

### Shell Integration
- Open files with default application
- Open URLs in browser
- Show files in file manager
- Beep sound

### File System Watching
- Watch files and directories for changes
- Recursive watching support
- Change event types: create, modify, delete, rename

### Power Monitor
- Battery status and percentage
- AC/battery power state
- System idle time detection
- Suspend/resume events
- Lock/unlock screen events

### Navigation API
- WebView navigation: back, forward, reload
- Can go back/forward state

## Examples

The `examples/` directory contains working demo applications:

| Example | Description |
|---------|-------------|
| **hello-world** | Basic window with HTML |
| **notes-app** | Full-featured notes application |
| **multi-window** | Multiple windows with settings |
| **tray-app** | System tray with notifications |
| **file-browser** | File dialogs and file watching |
| **power-monitor** | Battery and power events |
| **clipboard-manager** | Clipboard history with tray |

Run any example:
```bash
cd examples/<example-name>
bun run main.ts
```

## Project Structure

```
bunlet/
├── packages/
│   ├── bunlet/              # TypeScript API layer
│   │   └── src/
│   │       ├── app.ts       # Application lifecycle
│   │       ├── browser-window.ts
│   │       ├── dialog.ts
│   │       ├── menu.ts
│   │       ├── tray.ts
│   │       ├── notification.ts
│   │       ├── clipboard.ts
│   │       ├── global-shortcut.ts
│   │       ├── shell.ts
│   │       ├── file-watcher.ts
│   │       └── power-monitor.ts
│   │
│   ├── bunlet-native/       # Rust NAPI bindings
│   │   └── src/
│   │       ├── lib.rs       # Core runtime & window management
│   │       ├── window.rs    # Window options
│   │       ├── dialog.rs    # Native dialogs
│   │       ├── menu.rs      # Menu system
│   │       ├── tray.rs      # System tray
│   │       ├── notification.rs
│   │       ├── clipboard.rs
│   │       ├── global_shortcut.rs
│   │       ├── shell.rs
│   │       ├── file_watcher.rs
│   │       ├── power_monitor.rs
│   │       └── screen.rs    # Display info (Linux limited)
│   │
│   └── bunlet-cli/          # CLI tool (WIP)
│
├── examples/                # Demo applications
├── docs/                    # Canonical documentation
└── documentation/           # Deprecated documentation stub
```

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Your Application                   │
│                    (TypeScript)                      │
├─────────────────────────────────────────────────────┤
│                      bunlet                          │
│              (TypeScript API Layer)                  │
├─────────────────────────────────────────────────────┤
│                   bunlet-native                      │
│                (Rust + NAPI Bindings)                │
├──────────────────────┬──────────────────────────────┤
│         TAO          │           WRY                 │
│  (Window Management) │    (WebView Rendering)       │
├──────────────────────┴──────────────────────────────┤
│              Operating System                        │
│     Windows (WebView2) / macOS (WKWebView) /        │
│              Linux (WebKitGTK)                       │
└─────────────────────────────────────────────────────┘
```

## Known Limitations

### Linux
- **Screen API**: Display enumeration causes GTK/D-Bus conflicts with TAO's event loop. Window centering is affected.
- **WebView**: Requires WebKitGTK to be installed (`libwebkit2gtk-4.1-dev` on Ubuntu/Debian)

### General
- CEF backend parity is incomplete and capability-gated
- Native-originated window and navigation sync is still being tightened for full parity

## Requirements

- **Bun** 1.0 or later ([install](https://bun.sh))
- **Rust** stable >= 1.70 ([install via rustup](https://rustup.rs))
- **macOS**: Xcode Command Line Tools (`xcode-select --install`)
- **Windows 10/11** (x64): [WebView2 runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)
- **Linux**: WebKitGTK 4.1 (see below)

### Linux Dependencies

```bash
# Ubuntu/Debian
sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev libx11-dev librsvg2-dev

# Fedora
sudo dnf install webkit2gtk4.1-devel gtk3-devel libappindicator-gtk3-devel libX11-devel librsvg2-devel

# Arch
sudo pacman -S webkit2gtk-4.1 gtk3 libappindicator-gtk3
```

## Development

```bash
# Full setup (install + build native + build TS)
bun run setup

# Verify environment
bun run doctor

# Build individual pieces
bun run build:native      # Rust native module only
bun run build:packages    # TypeScript packages only

# Run tests
bun test

# Run the CLI from source
bun run dev -- <command>   # e.g. bun run dev -- create my-app
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, development workflow, and code style guidelines.

Repository docs live in [docs/index.md](docs/index.md). The `documentation/` tree is deprecated.

## License

MIT License - see [LICENSE](LICENSE) for details.

---

**Built with [Bun](https://bun.sh) and [Rust](https://www.rust-lang.org/)**
