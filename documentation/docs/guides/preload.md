# Preload Scripts

Preload scripts run in the renderer before the page loads, providing a secure bridge
between your main process and the web content.

## Why Preload Scripts?

The renderer (WebView) has access to `window.__bunlet` by default, which exposes
the full IPC bridge. In production apps, you should:

1. **Limit the API surface** — Only expose what the renderer needs
2. **Add type safety** — Define clear interfaces for your API
3. **Prevent misuse** — The renderer can't call handlers you don't expose

## Basic Setup

### 1. Create a Preload Script

```typescript
// preload.ts
import { contextBridge, ipcRenderer } from 'bunlet';

contextBridge.exposeInMainWorld('api', {
  // Request/response patterns
  getFiles: () => ipcRenderer.invoke('get-files'),
  openFile: (path: string) => ipcRenderer.invoke('open-file', { path }),

  // No-argument calls
  getVersion: () => ipcRenderer.invoke('get-version'),
});
```

### 2. Load the Preload in BrowserWindow

```typescript
// main.ts
import { app, BrowserWindow } from 'bunlet';
import path from 'path';

const win = new BrowserWindow({
  webPreferences: {
    preload: path.join(import.meta.dir, 'preload.ts'),
  },
});
```

!!! note "TypeScript Preload Scripts"

    Bunlet automatically transpiles `.ts` preload scripts to JavaScript before
    injecting them into the WebView. You can use `.ts` files directly — no separate
    build step needed.

### 3. Use the API in the Renderer

```javascript
// renderer (index.html)
const files = await window.api.getFiles();
await window.api.openFile('/path/to/file');
```

## Exposing Event Listeners

For main-to-renderer push events, expose typed listeners:

```typescript
// preload.ts
import { contextBridge, ipcRenderer } from 'bunlet';

contextBridge.exposeInMainWorld('api', {
  // Request/response
  getFiles: () => ipcRenderer.invoke('get-files'),
  openFile: (path: string) => ipcRenderer.invoke('open-file', { path }),

  // Event listeners (return unsubscribe function)
  onFileChanged: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('file-changed', handler);
    return () => ipcRenderer.off('file-changed', handler);
  },
});
```

```typescript
// main.ts - send events
win.webContents.send('file-changed', { path: '/path/to/file', type: 'modified' });
```

```javascript
// renderer
const unsubscribe = window.api.onFileChanged((data) => {
  console.log('File changed:', data.path, data.type);
});

// Later, when you want to stop listening
unsubscribe();
```

## Full Example: Clipboard Manager

```typescript
// preload.ts
import { contextBridge, ipcRenderer } from 'bunlet';

type ClipboardItem = { text: string; timestamp: number };

contextBridge.exposeInMainWorld('api', {
  // Clipboard operations
  getHistory: (): Promise<ClipboardItem[]> =>
    ipcRenderer.invoke('get-history'),

  copyToClipboard: (text: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('copy-to-clipboard', { text }),

  clearHistory: (): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('clear-history'),

  // Real-time updates
  onHistoryUpdated: (callback: (items: ClipboardItem[]) => void) => {
    const handler = (_event, data) => callback(data as ClipboardItem[]);
    ipcRenderer.on('history-updated', handler);
    return () => ipcRenderer.off('history-updated', handler);
  },
});
```

```typescript
// main.ts
import { app, BrowserWindow, clipboard, z } from 'bunlet';
import path from 'path';

let history: Array<{ text: string; timestamp: number }> = [];

app.handle('get-history', z.object({}), async () => history);

app.handle('copy-to-clipboard', z.object({ text: z.string() }), async (params) => {
  clipboard.writeText(params.text);
  return { success: true };
});

app.handle('clear-history', z.object({}), async () => {
  history = [];
  return { success: true };
});

app.on('window-all-closed', () => app.quit());

await app.whenReady();

const win = new BrowserWindow({
  width: 400,
  height: 500,
  title: 'Clipboard Manager',
  webPreferences: {
    preload: path.join(import.meta.dir, 'preload.ts'),
  },
});
win.loadFile(path.join(import.meta.dir, 'index.html'));

app.run();
```

## Type Safety

Create a shared types file that both main and renderer can reference:

```typescript
// shared/types.ts
export interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modified: string;
}

export interface Api {
  getFiles: (dir?: string) => Promise<FileItem[]>;
  openFile: (path: string) => Promise<{ success: boolean }>;
  onFileChanged: (callback: (event: { type: string; paths: string[] }) => void) => () => void;
}
```

```typescript
// preload.ts
import { contextBridge, ipcRenderer } from 'bunlet';
import type { Api } from './shared/types';

const api: Api = {
  getFiles: (dir) => ipcRenderer.invoke('get-files', dir ? { path: dir } : {}),
  openFile: (path) => ipcRenderer.invoke('open-file', { path }),
  onFileChanged: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('file-changed', handler);
    return () => ipcRenderer.off('file-changed', handler);
  },
};

contextBridge.exposeInMainWorld('api', api);
```

```typescript
// renderer.d.ts (TypeScript declaration for the renderer)
interface Window {
  api: import('./shared/types').Api;
}
```

## ipcRenderer API

The `ipcRenderer` object available in preload scripts:

| Method | Description |
|--------|-------------|
| `invoke(channel, ...args)` | Call a handler, returns Promise |
| `send(channel, ...args)` | Send fire-and-forget message |
| `on(channel, listener)` | Listen for main-to-renderer messages |
| `off(channel, listener)` | Remove a listener |

### invoke

```typescript
// With params
const result = await ipcRenderer.invoke('my-handler', { key: 'value' });

// Without params (empty schema)
const result = await ipcRunner.invoke('get-status');
```

### on / off

```typescript
const handler = (_event, data) => {
  console.log('Event:', data);
};

ipcRenderer.on('my-event', handler);

// Later
ipcRenderer.off('my-event', handler);
```

## contextBridge API

| Method | Description |
|--------|-------------|
| `exposeInMainWorld(key, api)` | Expose an API object on `window[key]` |

```typescript
contextBridge.exposeInMainWorld('api', {
  myMethod: () => ipcRenderer.invoke('my-method'),
});
// Now available as: window.api.myMethod()
```

## Best Practices

1. **Always use preload scripts in production** — Never expose `window.__bunlet` directly in production HTML.

2. **Return unsubscribe functions** from event listeners to prevent memory leaks:
   ```typescript
   onMyEvent: (callback) => {
     const handler = (_event, data) => callback(data);
     ipcRenderer.on('my-event', handler);
     return () => ipcRenderer.off('my-event', handler);
   }
   ```

3. **Cast types in the preload** — Use `as` to satisfy TypeScript when passing data from `ipcRenderer.on`:
   ```typescript
   onFileChanged: (callback) => {
     ipcRenderer.on('file-changed', (_event, data) => callback(data as FileChangeEvent));
   }
   ```

4. **Use `import.meta.dir` for path resolution** — This works reliably regardless of working directory:
   ```typescript
   preload: path.join(import.meta.dir, 'preload.ts')
   ```

5. **Keep preload scripts small** — Only expose what the renderer needs. Complex logic should live in the main process.

## Next Steps

- [IPC Communication](ipc.md) - Full IPC guide
- [Windows Guide](windows.md) - Window management
- [API Reference: BrowserWindow](../api/browser-window.md) - Window options including `webPreferences.preload`