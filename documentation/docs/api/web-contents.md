# WebContents

Control the web page displayed in a window.

```typescript
const webContents = browserWindow.webContents;
```

## Methods

### `send(channel, ...args)`

Send a message to the renderer process via IPC. The renderer can listen
with `window.__bunlet.on(channel, callback)`.

```typescript
webContents.send('my-event', { key: 'value' });
webContents.send('notification', 'Hello', 42);
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `channel` | `string` | Event channel name |
| `...args` | `unknown[]` | Arguments passed to the renderer listener |

```typescript
// Main process
webContents.send('file-changed', { path: '/data.txt', type: 'modified' });
```

```javascript
// Renderer
window.__bunlet.on('file-changed', (event, data) => {
  console.log('File changed:', data.path, data.type);
});
```

!!! tip "Preload pattern"

    For production apps, expose typed event listeners via a preload script
    instead of using `window.__bunlet.on()` directly. See [Preload Scripts](../guides/preload.md).

---

### `executeJavaScript(code)`

Execute JavaScript in the WebView.

```typescript
const title = await webContents.executeJavaScript('document.title');
const result = await webContents.executeJavaScript('1 + 1');
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `code` | `string` | JavaScript code to execute |

**Returns:** `Promise<unknown>`

!!! note

    With the system WebView backend, `executeJavaScript()` is fire-and-forget
    and always returns `undefined`. The CEF backend returns actual values.

---

### `openDevTools(options?)`

Open DevTools.

```typescript
webContents.openDevTools();
webContents.openDevTools({ mode: 'detach' });
```

| Option | Type | Description |
|--------|------|-------------|
| `mode` | `'right' \| 'bottom' \| 'detach'` | Panel position |

---

### `closeDevTools()`

Close DevTools.

```typescript
webContents.closeDevTools();
```

---

### `toggleDevTools()`

Toggle DevTools visibility.

```typescript
webContents.toggleDevTools();
```

---

### `isDevToolsOpened()`

Check if DevTools is open.

```typescript
if (webContents.isDevToolsOpened()) {
  webContents.closeDevTools();
}
```

**Returns:** `boolean`

---

### `reload()`

Reload the page.

```typescript
webContents.reload();
```

---

### `stop()`

Stop loading the page.

```typescript
webContents.stop();
```

---

### `goBack()`

Navigate back in history.

```typescript
webContents.goBack();
```

---

### `goForward()`

Navigate forward in history.

```typescript
webContents.goForward();
```

---

### `canGoBack()`

Check if back navigation is possible.

```typescript
if (webContents.canGoBack()) {
  webContents.goBack();
}
```

**Returns:** `boolean`

---

### `canGoForward()`

Check if forward navigation is possible.

```typescript
if (webContents.canGoForward()) {
  webContents.goForward();
}
```

**Returns:** `boolean`

---

### `getURL()`

Get the current page URL.

```typescript
const url = webContents.getURL();
```

**Returns:** `string`

---

### `getTitle()`

Get the page title.

```typescript
const title = webContents.getTitle();
```

**Returns:** `string`

---

## Events

### `devtools-opened`

Emitted when DevTools are opened.

```typescript
webContents.on('devtools-opened', () => {
  console.log('DevTools opened');
});
```

---

### `devtools-closed`

Emitted when DevTools are closed.

```typescript
webContents.on('devtools-closed', () => {
  console.log('DevTools closed');
});
```

---

### `preload-success`

Emitted when the preload script loads successfully.

```typescript
webContents.on('preload-success', (preloadPath) => {
  console.log('Preload loaded:', preloadPath);
});
```

---

### `preload-error`

Emitted when the preload script fails to load.

```typescript
webContents.on('preload-error', ({ path, message }) => {
  console.error('Preload error:', path, message);
});
```

## Example

```typescript
import { BrowserWindow } from '@bunlet/core';
import path from 'path';

const win = new BrowserWindow({
  webPreferences: {
    preload: path.join(import.meta.dir, 'preload.ts'),
  },
});
win.loadFile(path.join(import.meta.dir, 'index.html'));

// Send data to the renderer
win.webContents.send('app-ready', { version: '1.0.0' });

// Execute JavaScript
const title = await win.webContents.executeJavaScript('document.title');

// DevTools
if (process.env.NODE_ENV === 'development') {
  win.webContents.openDevTools();
}

// Listen for preload events
win.webContents.on('preload-success', (preloadPath) => {
  console.log('Preload loaded:', preloadPath);
});

win.webContents.on('preload-error', ({ path, message }) => {
  console.error('Preload error:', path, message);
});
```