# Migrating from Electron to Bunlet

This guide helps you migrate an Electron application to Bunlet. Bunlet provides a compatible API surface, but there are important differences.

## Quick Reference

| Electron | Bunlet | Notes |
|----------|--------|-------|
| `app.on('ready', ...)` | `app.on('ready', ...)` | Same |
| `app.whenReady()` | `await app.whenReady()` | Returns a promise |
| `new BrowserWindow({...})` | `new BrowserWindow({...})` | Subset of options |
| `win.loadURL(url)` | `await win.loadURL(url)` | Async in Bunlet |
| `win.loadFile(path)` | `await win.loadFile(path)` | Async in Bunlet |
| `ipcMain.handle()` | `app.handle()` | Uses Zod schemas |
| `ipcRenderer.invoke()` | `ipcRenderer.invoke()` | From `'bunlet'` import |
| `contextBridge` | `contextBridge` | From `'bunlet'` import |
| `app.getPath()` | `app.getPath()` | Subset of path names |
| `autoUpdater` | `autoUpdater` | Provider-based |
| `session.defaultSession` | `session.defaultSession` | Partition-based |

## API Differences

### BrowserWindow Options

Bunlet supports a subset of Electron's BrowserWindow options:

**Supported:**
- `width`, `height`, `x`, `y` — Window dimensions and position
- `title` — Window title
- `url` or `file` — Initial content
- `center` — Present in type but auto-centering is async
- `alwaysOnTop` — Always-on-top behavior
- `fullscreen` — Start fullscreen
- `transparent` — Transparent window
- `frame` — Frameless window
- `webPreferences.preload` — Preload script path
- `webPreferences.contextIsolation` — Context isolation

**Not Supported:**
- `titleBarStyle`, `vibrancy`, `backgroundMaterial` — Not in current API
- `minWidth`, `minHeight`, `maxWidth`, `maxHeight` — Not yet implemented
- `backgroundColor` — Type exists but setter throws
- `resizable`, `movable`, `minimizable`, `maximizable`, `closable` — Not yet implemented

### IPC

Bunlet uses Zod schemas for IPC handler validation:

```ts
// Electron
ipcMain.handle('get-version', async () => '1.0.0');

// Bunlet
import { z } from 'zod';
app.handle('get-version', z.object({}), async () => '1.0.0');
```

**Import path:** Use `import { contextBridge, ipcRenderer } from '@bunlet/core'` (not `'bunlet/renderer'`).

**IPCContext:** `app.handle()` receives `{ window: BrowserWindow; windowId: number }`, not `{ window: BrowserWindow; sender: WebContents }`.

### App Paths

Bunlet supports these path names via `app.getPath()`:

| Path Name | Status |
|-----------|--------|
| `home` | Supported |
| `appData` | Supported |
| `userData` | Supported |
| `temp` | Supported |
| `desktop` | Supported |
| `documents` | Supported |
| `downloads` | Supported |
| `music` | Supported |
| `pictures` | Supported |
| `videos` | Supported |
| `exe` | Supported (Bunlet-specific) |
| `cache` | Supported (Bunlet-specific) |
| `data` | Supported (Bunlet-specific) |
| `dataLocal` | Supported (Bunlet-specific) |
| `runtime` | Supported (Bunlet-specific) |

**Not supported:** `logs`, `recent` (Electron-specific)

**Not implemented:** `app.setPath()`, `app.isPackaged`

### Events

**App events that work:**
- `ready` — App initialized
- `window-all-closed` — All windows closed
- `before-quit` — Preventable quit
- `will-quit` — Before quit
- `quit` — After quit

**App events with limited support:**
- `activate` — May not fire on all platforms
- `open-file`, `open-url` — Not yet wired from native layer

**Not implemented:**
- `second-instance` — No single-instance lock yet
- `browser-window-focus-changed`, etc.

### Auto-Updater

Bunlet's auto-updater uses a provider-based architecture:

```ts
import { autoUpdater } from '@bunlet/core';

// GitHub releases
autoUpdater.setFeedURL({
  provider: 'github',
  github: { owner: 'myorg', repo: 'myapp' },
});

// Or custom server
autoUpdater.setFeedURL({
  provider: 'generic',
  generic: { url: 'https://updates.example.com' },
});
```

**Staged rollout:**

```ts
autoUpdater.setRolloutPolicy({
  rolloutPercentage: 25, // 25% of users
  userId: 'user-123',     // Deterministic assignment
});
```

**Custom install strategy:**

```ts
import { AutoUpdater } from '@bunlet/core';

const updater = new AutoUpdater();
updater.registerInstallStrategy('freebsd', myCustomInstallStrategy);
```

### Session / Cookies

```ts
// Default session
const cookies = session.defaultSession.cookies;

// Cookie methods (limited on system webview)
await cookies.get({ domain: 'example.com' });
await cookies.set({ url: 'https://example.com', name: 'token', value: 'abc' });
await cookies.remove('https://example.com', 'token');

// Custom partition
const customSession = session.fromPartition('persist:custom');
```

**Note:** On system webview, `cookies.get()` always returns an empty array. Use CEF mode for full cookie support.

## CEF Mode

For full Chromium compatibility (DevTools, CSS features, cookie management), use CEF mode:

```ts
// bunlet.config.ts
export default defineConfig({
  webview: {
    engine: 'cef',
  },
});
```

Or set via environment variable: `BUNLET_WEBVIEW_ENGINE=cef`

CEF mode enables:
- Full DevTools support
- `executeJavaScript()` that returns values
- Authoritative `getURL()`, `getTitle()`
- Complete cookie management via CEF `CookieManager`
- Session partitions via CEF `RequestContext`

## Not Yet Available

The following Electron APIs are not yet available in Bunlet:

- `app.focus()`, `app.hide()`, `app.show()`
- `app.requestSingleInstanceLock()` / `app.hasSingleInstanceLock()`
- `app.setPath()`
- `app.isPackaged`
- `BrowserWindow.setBackgroundColor()` — Throws "not yet supported"
- `WebMenu()` / popup context menus
- `nativeImage` module
- `clipboard` read/write on system webview (limited)
- `shell.openExternal()` limitations on system webview