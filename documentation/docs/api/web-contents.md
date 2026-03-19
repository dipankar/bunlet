# WebContents

Control the web page displayed in a window.

```typescript
const webContents = browserWindow.webContents;
```

## Methods

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

## Events

### `devtools-opened`

Emitted when DevTools is opened.

```typescript
webContents.on('devtools-opened', () => {
  console.log('DevTools opened');
});
```

---

### `devtools-closed`

Emitted when DevTools is closed.

```typescript
webContents.on('devtools-closed', () => {
  console.log('DevTools closed');
});
```

## Example

```typescript
import { BrowserWindow } from 'bunlet';

const win = new BrowserWindow();
win.loadFile('index.html');

// Execute JavaScript
const title = await win.webContents.executeJavaScript(
  'document.title'
);

// Manipulate the page
await win.webContents.executeJavaScript(`
  document.body.style.backgroundColor = 'red';
`);

// Get data
const data = await win.webContents.executeJavaScript(`
  JSON.stringify(localStorage.getItem('user'))
`);

// DevTools
if (process.env.NODE_ENV === 'development') {
  win.webContents.openDevTools();
}
```
