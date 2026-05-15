# bunlet

> Build cross-platform desktop apps with Bun and WebView — a lightweight, familiar alternative to Electron.

[![npm version](https://img.shields.io/npm/v/bunlet)](https://www.npmjs.com/package/bunlet)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-%3E%3D1.0-orange.svg)](https://bun.sh/)

Bunlet combines Bun's speed with native system WebViews. You get an Electron-compatible API, type-safe IPC via Zod, and a Rust-backed native layer — without bundling Chromium.

---

## Quick Start

```bash
bun add bunlet
```

**`main.ts`**
```typescript
import { app, BrowserWindow, z } from 'bunlet';
import path from 'path';

// Register type-safe IPC handlers before the app is ready
app.handle('greet', z.object({ name: z.string() }), async ({ name }) => {
  return { message: `Hello, ${name}!` };
});

// Wait for the native runtime to initialise
await app.whenReady();

const win = new BrowserWindow({
  width: 800,
  height: 600,
  title: 'My Bunlet App',
  webPreferences: {
    preload: './preload.ts',
  },
});

// Load a local HTML file or a remote URL
win.loadFile(path.join(import.meta.dir, 'index.html'));

// Start the event loop (blocking — call this last)
app.run();
```

**`preload.ts`**
```typescript
import { contextBridge, ipcRenderer } from 'bunlet';

contextBridge.exposeInMainWorld('api', {
  greet: (name: string) => ipcRenderer.invoke('greet', { name }),
});
```

**`index.html`**
```html
<!DOCTYPE html>
<html>
<body>
  <h1>Bunlet App</h1>
  <button onclick="greet()">Greet</button>
  <script>
    async function greet() {
      const result = await window.api.greet('World');
      alert(result.message);
    }
  </script>
</body>
</html>
```

```bash
bun run main.ts
```

---

## Why Bunlet?

| | Bunlet | Electron | Tauri |
|---|---|---|---|
| **Runtime** | Bun (JavaScriptCore) | Node.js (V8) | Rust |
| **WebView** | System WebView | Chromium (bundled) | System WebView |
| **App size** | ~20–40 MB | 80–150 MB | 2–10 MB |
| **Language** | TypeScript | JavaScript / HTML | Rust + JS |
| **IPC** | Zod-validated, Electron-compatible | contextBridge / ipcMain | Command-based |
| **Learning curve** | Low (Electron-like API) | Low | Moderate |
| **Dev experience** | Bun's bundler, HMR | webpack / vite | Rust toolchain |

- **Familiar API** — if you've used Electron, you already know Bunlet. `app`, `BrowserWindow`, `ipcMain`/`ipcRenderer`, `Menu`, `Tray`, `dialog`, `Notification` all work the same way.
- **TypeScript-first** — full type safety with Zod schema validation on every IPC channel. Invalid payloads are rejected before your handler runs.
- **Small footprint** — uses the OS WebView (WebKit on macOS, WebView2 on Windows, WebKitGTK on Linux). No bundled browser engine.
- **Rust performance** — native module written in Rust with NAPI bindings. Window management, IPC dispatch, and platform APIs run outside the JS thread.

---

## Platform Support

| Platform | WebView Engine | Status |
|---|---|---|
| macOS 11+ (arm64 / x64) | WKWebView | Stable |
| Windows 10+ (x64) | WebView2 | Stable |
| Linux | WebKitGTK 4.1 | Stable |

### Linux dependencies

```bash
# Ubuntu / Debian
sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev

# Fedora
sudo dnf install webkit2gtk4.1-devel gtk3-devel

# Arch
sudo pacman -S webkit2gtk-4.1 gtk3
```

---

## API Overview

### Application lifecycle

```typescript
import { app } from 'bunlet';

app.handle('channel', schema, handler);   // register IPC handler
app.removeHandler('channel');             // remove IPC handler
await app.whenReady();                    // wait for native runtime
app.run();                                // start event loop (blocking)
app.quit();                               // gracefully quit
app.exit(code);                           // force exit
app.relaunch();                           // restart the app
app.getPath('userData');                  // platform-aware paths
app.getName();                            // app name
app.getVersion();                         // app version

app.on('ready', () => {});
app.on('window-all-closed', () => {});
app.on('before-quit', (event) => { event.preventDefault(); });
app.on('will-quit', () => {});
app.on('quit', () => {});
```

### BrowserWindow

```typescript
import { BrowserWindow } from 'bunlet';

const win = new BrowserWindow({
  width: 800,
  height: 600,
  title: 'Bunlet',
  resizable: true,
  frame: true,
  show: true,
  transparent: false,
  alwaysOnTop: false,
  minWidth: 400,
  minHeight: 300,
  webPreferences: {
    preload: './preload.ts',
    devTools: true,
    partition: 'persist:my-session',
  },
  parent: parentWindow,   // child window
  modal: true,            // modal dialog
});

// Content
win.loadFile('index.html');
win.loadURL('https://example.com');
win.webContents.reload();

// Visibility
win.show();
win.hide();
win.focus();
win.blur();

// State
win.maximize();
win.minimize();
win.restore();
win.setFullScreen(true);
win.isMaximized();

// Geometry
const bounds = win.getBounds();
win.setBounds({ x: 100, y: 100, width: 800, height: 600 });
win.setSize(1024, 768);
win.setPosition(0, 0);
win.center();

// Properties
win.setTitle('New Title');
win.setAlwaysOnTop(true);

// Lifecycle
win.close();
win.destroy();
win.isDestroyed();

// Events
win.on('close', (event) => { event.preventDefault(); });
win.on('closed', () => {});
win.on('focus', () => {});
win.on('blur', () => {});
win.on('maximize', () => {});
win.on('minimize', () => {});
win.on('resize', (bounds) => {});
win.on('move', (bounds) => {});
win.on('enter-full-screen', () => {});
win.on('leave-full-screen', () => {});
win.on('file-drop', (files) => {});
win.on('ready-to-show', () => {});

// Static methods
BrowserWindow.getAllWindows();
BrowserWindow.getFocusedWindow();
BrowserWindow.fromId(id);
```

### IPC (Inter-Process Communication)

```typescript
// Main process
app.handle('do-thing', z.object({ id: z.string() }), async (params, ctx) => {
  // ctx.window → the BrowserWindow that sent the request
  // ctx.windowId → numeric window id
  return { ok: true };
});

// Send a message to the renderer from main
win.webContents.send('event-name', { data: 123 });

// Preload script
import { contextBridge, ipcRenderer } from 'bunlet';

contextBridge.exposeInMainWorld('api', {
  doThing: (id: string) => ipcRenderer.invoke('do-thing', { id }),
  onEvent: (cb) => ipcRenderer.on('event-name', cb),
});

// Renderer (browser)
const result = await window.api.doThing('abc');
window.api.onEvent((event, data) => console.log(data));
```

### Native APIs

```typescript
import { dialog, Menu, Tray, Notification, clipboard, shell, globalShortcut, powerMonitor, screen, fileWatcher } from 'bunlet';

// File dialogs
const { filePath, canceled } = await dialog.showOpenDialog({
  title: 'Open File',
  filters: [{ name: 'Images', extensions: ['png', 'jpg'] }],
});
await dialog.showSaveDialog({ title: 'Save As' });
const { response } = await dialog.showMessageBox({ type: 'info', message: 'Done!' });

// Menus
const menu = Menu.buildFromTemplate([
  { label: 'File', submenu: [{ label: 'Quit', role: 'quit' }] },
  { label: 'Edit', submenu: [{ label: 'Copy', accelerator: 'CmdOrCtrl+C', role: 'copy' }] },
]);
Menu.setApplicationMenu(menu);

// Context menus
win.webContents.on('context-menu', () => {
  const ctxMenu = Menu.buildFromTemplate([
    { label: 'Inspect', click: () => win.webContents.openDevTools() },
  ]);
  ctxMenu.popup();
});

// System tray
const tray = new Tray('/path/to/icon.png');
tray.setToolTip('My App');
tray.setContextMenu(menu);
tray.on('click', () => win.show());

// Notifications
new Notification({ title: 'Hello', body: 'World!' }).show();

// Clipboard
clipboard.writeText('copied!');
const text = clipboard.readText();

// Shell
shell.openExternal('https://bun.sh');
shell.showItemInFolder('/path/to/file');

// Global shortcuts
globalShortcut.register('CmdOrCtrl+Shift+K', () => console.log('pressed!'));

// Power monitor
const info = powerMonitor.getBatteryInfo();
powerMonitor.on('suspend', () => {});
powerMonitor.on('resume', () => {});

// Screen
const displays = screen.getAllDisplays();
const primary = screen.getPrimaryDisplay();

// File watching
const watcher = fileWatcher.watch('/path/to/dir', { recursive: true });
watcher.on('change', (event) => console.log(event));
```

### Auto-Updater

```typescript
import { autoUpdater } from 'bunlet';

autoUpdater.setFeedURL({
  provider: 'github',
  github: { owner: 'user', repo: 'my-app' },
});

autoUpdater.on('update-available', (info) => console.log('New version:', info.version));
autoUpdater.on('download-progress', (p) => console.log(`${p.percent}%`));
autoUpdater.on('update-downloaded', () => autoUpdater.quitAndInstall());

autoUpdater.checkForUpdates();
```

### Session & Cookies

```typescript
import { session } from 'bunlet';

const sess = session.fromPartition('persist:my-partition');
const cookies = await sess.cookies.get({ url: 'https://example.com' });
await sess.cookies.set({ url: 'https://example.com', name: 'token', value: 'abc' });
await sess.clearStorageData({ storages: ['cookies', 'localstorage'] });
```

---

## Configuration

Bunlet apps can declare a `bunlet.config.ts` (or `bunlet.config.js`) at the project root:

```typescript
import { defineConfig } from 'bunlet/config';

export default defineConfig({
  main: 'src/main.ts',
  preload: 'src/preload.ts',
  renderer: {
    root: 'renderer',
    index: 'index.html',
  },
  webview: {
    engine: 'system',   // or 'cef' for the CEF backend
  },
  build: {
    outDir: 'dist',
    minify: true,
    sourcemap: 'external',
  },
  package: {
    name: 'my-app',
    version: '1.0.0',
    bundleId: 'com.example.myapp',
    icon: './icon.png',
    mac: { category: 'public.app-category.developer-tools' },
  },
  publish: {
    provider: 'github',
    owner: 'user',
    repo: 'my-app',
  },
});
```

---

## Requirements

- **Bun** >= 1.0 ([install](https://bun.sh))
- macOS: Xcode Command Line Tools (`xcode-select --install`)
- Windows 10+ (x64): [WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (pre-installed on Windows 11)
- Linux: WebKitGTK 4.1 (see [Platform Support](#platform-support))

---

## Known Limitations

- **Linux Screen API**: display enumeration can conflict with GTK's event loop. Window centering may use fallback values.
- **System WebView cookies**: the system WebView backend cannot enumerate cookies; `cookies.get()` returns `[]`. Use the CEF backend for full cookie support.
- **`executeJavaScript` is fire-and-forget** on the system WebView backend. Use IPC to return values from JS.
- **CEF backend** is optional and requires building the `@bunlet/cef` package. Parity is in progress.

See the [repository docs](https://github.com/dipankar/bunlet) for architecture details and the full roadmap.

---

## License

MIT — see [LICENSE](https://github.com/dipankar/bunlet/blob/main/LICENSE).
