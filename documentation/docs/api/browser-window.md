# BrowserWindow

Create and control application windows.

```typescript
import { BrowserWindow } from 'bunlet';
```

## Constructor

```typescript
new BrowserWindow(options?: BrowserWindowOptions)
```

### Options

```typescript
interface BrowserWindowOptions {
  // Size
  width?: number;              // Default: 800
  height?: number;             // Default: 600
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;

  // Position
  x?: number;
  y?: number;
  center?: boolean;            // Default: true

  // Appearance
  title?: string;
  frame?: boolean;             // Default: true
  transparent?: boolean;       // Default: false
  backgroundColor?: string;
  alwaysOnTop?: boolean;       // Default: false

  // Behavior
  show?: boolean;              // Default: true
  resizable?: boolean;         // Default: true
  movable?: boolean;           // Default: true
  minimizable?: boolean;       // Default: true
  maximizable?: boolean;       // Default: true
  closable?: boolean;          // Default: true
  fullscreen?: boolean;        // Default: false
  fullscreenable?: boolean;    // Default: true
  skipTaskbar?: boolean;       // Default: false

  // Modal
  modal?: boolean;             // Default: false
  parent?: BrowserWindow;

  // Web
  webPreferences?: WebPreferences;
}
```

## Instance Properties

### `id`

Unique window identifier.

```typescript
console.log(win.id); // e.g., 1
```

**Type:** `number` (read-only)

---

### `webContents`

The window's WebContents instance.

```typescript
win.webContents.executeJavaScript('alert("Hello")');
```

**Type:** `WebContents` (read-only)

## Instance Methods

### Content Loading

#### `loadURL(url)`

Load a URL.

```typescript
await win.loadURL('https://example.com');
await win.loadURL('http://localhost:5173');
```

**Returns:** `Promise<void>`

---

#### `loadFile(filePath)`

Load a local file.

```typescript
await win.loadFile('index.html');
await win.loadFile('pages/about.html');
```

**Returns:** `Promise<void>`

---

#### `reload()`

Reload the page.

```typescript
win.reload();
```

### Visibility

#### `show()`

Show the window.

```typescript
win.show();
```

---

#### `hide()`

Hide the window.

```typescript
win.hide();
```

---

#### `focus()`

Focus the window.

```typescript
win.focus();
```

---

#### `blur()`

Remove focus from the window.

```typescript
win.blur();
```

### State Checks

#### `isVisible()`

```typescript
if (win.isVisible()) { }
```

**Returns:** `boolean`

---

#### `isFocused()`

```typescript
if (win.isFocused()) { }
```

**Returns:** `boolean`

---

#### `isMaximized()`

```typescript
if (win.isMaximized()) { }
```

**Returns:** `boolean`

---

#### `isMinimized()`

```typescript
if (win.isMinimized()) { }
```

**Returns:** `boolean`

---

#### `isFullScreen()`

```typescript
if (win.isFullScreen()) { }
```

**Returns:** `boolean`

---

#### `isDestroyed()`

```typescript
if (win.isDestroyed()) { }
```

**Returns:** `boolean`

### Window Controls

#### `maximize()`

Maximize the window.

```typescript
win.maximize();
```

---

#### `unmaximize()`

Exit maximized state.

```typescript
win.unmaximize();
```

---

#### `minimize()`

Minimize the window.

```typescript
win.minimize();
```

---

#### `restore()`

Restore from minimized/maximized state.

```typescript
win.restore();
```

---

#### `setFullScreen(flag)`

Enter or exit fullscreen.

```typescript
win.setFullScreen(true);
win.setFullScreen(false);
```

### Geometry

#### `getBounds()`

Get window position and size.

```typescript
const bounds = win.getBounds();
// { x: 100, y: 100, width: 800, height: 600 }
```

**Returns:** `Rectangle`

---

#### `setBounds(bounds, animate?)`

Set window position and size.

```typescript
win.setBounds({ x: 100, y: 100, width: 1024, height: 768 });
```

---

#### `setSize(width, height, animate?)`

Set window size.

```typescript
win.setSize(1024, 768);
```

---

#### `setPosition(x, y, animate?)`

Set window position.

```typescript
win.setPosition(100, 100);
```

---

#### `center()`

Center window on screen.

```typescript
win.center();
```

### Properties

#### `setTitle(title)`

Set window title.

```typescript
win.setTitle('New Title');
```

---

#### `getTitle()`

Get window title.

```typescript
const title = win.getTitle();
```

**Returns:** `string`

---

#### `setAlwaysOnTop(flag)`

Keep window on top.

```typescript
win.setAlwaysOnTop(true);
```

---

#### `setBackgroundColor(color)`

Set background color.

```typescript
win.setBackgroundColor('#ffffff');
```

### Lifecycle

#### `close()`

Close the window. Emits `close` event which can be prevented.

```typescript
win.close();
```

---

#### `destroy()`

Force close without events.

```typescript
win.destroy();
```

### IPC

#### `send(channel, ...args)`

Send message to renderer.

```typescript
win.send('notification', { message: 'Hello' });
```

## Static Methods

### `getAllWindows()`

Get all open windows.

```typescript
const windows = BrowserWindow.getAllWindows();
```

**Returns:** `BrowserWindow[]`

---

### `getFocusedWindow()`

Get the focused window.

```typescript
const focused = BrowserWindow.getFocusedWindow();
```

**Returns:** `BrowserWindow | null`

---

### `fromId(id)`

Get window by ID.

```typescript
const win = BrowserWindow.fromId(1);
```

**Returns:** `BrowserWindow | null`

## Events

| Event | Description |
|-------|-------------|
| `did-start-loading` | Page started loading |
| `did-finish-load` | Page finished loading |
| `show` | Window shown |
| `hide` | Window hidden |
| `focus` | Window focused |
| `blur` | Window lost focus |
| `resize` | Window resized |
| `move` | Window moved |
| `maximize` | Window maximized |
| `unmaximize` | Window unmaximized |
| `minimize` | Window minimized |
| `restore` | Window restored |
| `enter-full-screen` | Entered fullscreen |
| `leave-full-screen` | Left fullscreen |
| `close` | Window closing (preventable) |
| `closed` | Window closed |

### Event: `close`

```typescript
win.on('close', (event) => {
  event.preventDefault(); // Prevent close
});
```
