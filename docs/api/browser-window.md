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
  // Dimensions
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
  title?: string;              // Default: app name
  icon?: string;               // Path to icon
  show?: boolean;              // Default: true
  frame?: boolean;             // Default: true (native frame)
  transparent?: boolean;       // Default: false
  backgroundColor?: string;    // Default: '#ffffff'

  // macOS
  titleBarStyle?: 'default' | 'hidden' | 'hiddenInset' | 'customButtonsOnHover'; // Not yet implemented
  vibrancy?: string;           // macOS vibrancy effect (Not yet implemented)

  // Windows
  backgroundMaterial?: 'auto' | 'none' | 'mica' | 'acrylic' | 'tabbed'; // Not yet implemented

  // Behavior
  resizable?: boolean;         // Default: true
  movable?: boolean;           // Default: true
  minimizable?: boolean;       // Default: true
  maximizable?: boolean;       // Default: true
  closable?: boolean;          // Default: true
  alwaysOnTop?: boolean;       // Default: false
  fullscreen?: boolean;        // Default: false
  fullscreenable?: boolean;    // Default: true
  skipTaskbar?: boolean;       // Default: false

  // Parent-child
  parent?: BrowserWindow;
  modal?: boolean;             // Default: false

  // WebView
  webPreferences?: WebPreferences;
}

interface WebPreferences {
  preload?: string;            // Path to preload script
  partition?: string;          // Session partition name
  session?: Session;           // Explicit session object
  devTools?: boolean;          // Default: true
  contextIsolation?: boolean;  // Default: true
  sandbox?: boolean;           // Default: true
  webSecurity?: boolean;       // Default: true
}
```

## Static Methods

### `BrowserWindow.getAllWindows()`

Returns all open windows.

```typescript
BrowserWindow.getAllWindows(): BrowserWindow[]
```

### `BrowserWindow.getFocusedWindow()`

Returns the currently focused window.

```typescript
BrowserWindow.getFocusedWindow(): BrowserWindow | null
```

### `BrowserWindow.fromId(id)`

Returns window with the given ID.

```typescript
BrowserWindow.fromId(id: number): BrowserWindow | null
```

## Instance Properties

### `win.session`

The session associated with this window.

```typescript
const projectSession = Session.fromPartition('project-a');

const win = new BrowserWindow({
  webPreferences: {
    session: projectSession,
  },
});

console.log(win.session.partition);
```

## Instance Methods

### Content Loading

#### `win.loadURL(url)`

Loads a URL.

```typescript
win.loadURL(url: string): Promise<void>
```

**Example:**
```typescript
await win.loadURL('https://example.com');

// Development
await win.loadURL('http://localhost:5173');
```

#### `win.loadFile(filePath)`

Loads a local HTML file.

```typescript
win.loadFile(filePath: string): Promise<void>
```

**Example:**
```typescript
await win.loadFile('index.html');
await win.loadFile('./dist/renderer/index.html');
```

#### `win.reload()`

Reloads the current page.

```typescript
win.reload(): void
```

### Visibility

#### `win.show()`

Shows the window.

```typescript
win.show(): void
```

#### `win.hide()`

Hides the window.

```typescript
win.hide(): void
```

#### `win.focus()`

Focuses the window.

```typescript
win.focus(): void
```

#### `win.blur()`

Removes focus from the window.

```typescript
win.blur(): void
```

### State

#### `win.isVisible()`

```typescript
win.isVisible(): boolean
```

#### `win.isFocused()`

```typescript
win.isFocused(): boolean
```

#### `win.isMaximized()`

```typescript
win.isMaximized(): boolean
```

#### `win.isMinimized()`

```typescript
win.isMinimized(): boolean
```

#### `win.isFullScreen()`

```typescript
win.isFullScreen(): boolean
```

#### `win.isDestroyed()`

```typescript
win.isDestroyed(): boolean
```

### Window Controls

#### `win.maximize()`

Maximizes the window.

```typescript
win.maximize(): void
```

#### `win.unmaximize()`

Exits maximized state.

```typescript
win.unmaximize(): void
```

#### `win.minimize()`

Minimizes the window.

```typescript
win.minimize(): void
```

#### `win.restore()`

Restores minimized/maximized window.

```typescript
win.restore(): void
```

#### `win.setFullScreen(flag)`

Enters or exits fullscreen.

```typescript
win.setFullScreen(flag: boolean): void
```

### Geometry

#### `win.getBounds()`

Returns window bounds.

```typescript
win.getBounds(): Rectangle
// { x: number, y: number, width: number, height: number }
```

#### `win.setBounds(bounds, animate?)`

Sets window bounds.

```typescript
win.setBounds(bounds: Partial<Rectangle>, animate?: boolean): void
```

#### `win.setSize(width, height, animate?)`

Sets window size.

```typescript
win.setSize(width: number, height: number, animate?: boolean): void
```

#### `win.setPosition(x, y, animate?)`

Sets window position.

```typescript
win.setPosition(x: number, y: number, animate?: boolean): void
```

#### `win.center()`

Centers the window on screen.

```typescript
win.center(): void
```

### Properties

#### `win.setTitle(title)`

Sets the window title.

```typescript
win.setTitle(title: string): void
```

#### `win.getTitle()`

Gets the window title.

```typescript
win.getTitle(): string
```

#### `win.setAlwaysOnTop(flag)`

Makes window stay on top.

```typescript
win.setAlwaysOnTop(flag: boolean): void
```

#### `win.setBackgroundColor(color)`

Sets background color. ⚠️ *Currently throws an error.*

```typescript
win.setBackgroundColor(color: string): void
```

### Lifecycle

#### `win.close()`

Tries to close the window. Emits `close` event.

```typescript
win.close(): void
```

#### `win.destroy()`

Force closes without events.

```typescript
win.destroy(): void
```

### IPC

#### `win.send(channel, ...args)`

Sends message to renderer.

```typescript
win.send(channel: string, ...args: any[]): void
```

**Example:**
```typescript
win.send('update-available', { version: '2.0.0' });
```

### WebContents

Access the window's web contents:

```typescript
win.webContents.openDevTools();
win.webContents.closeDevTools();
win.webContents.toggleDevTools();
win.webContents.isDevToolsOpened();

// Execute JavaScript
const result = await win.webContents.executeJavaScript('1 + 1');
```

## Events

### `close`

Emitted before window closes. Can be prevented.

```typescript
win.on('close', (event) => {
  if (hasUnsavedChanges) {
    event.preventDefault();
    showSaveDialog();
  }
});
```

### `closed`

Emitted when window is closed.

```typescript
win.on('closed', () => {
  mainWindow = null;
});
```

### `focus`

Emitted when window gains focus.

```typescript
win.on('focus', () => {
  console.log('Window focused');
});
```

### `blur`

Emitted when window loses focus.

```typescript
win.on('blur', () => {
  console.log('Window blurred');
});
```

### `show` / `hide`

```typescript
win.on('show', () => {});
win.on('hide', () => {});
```

### `maximize` / `unmaximize`

```typescript
win.on('maximize', () => {});
win.on('unmaximize', () => {});
```

### `minimize` / `restore`

```typescript
win.on('minimize', () => {});
win.on('restore', () => {});
```

### `resize` / `move`

```typescript
win.on('resize', () => {
  const bounds = win.getBounds();
});

win.on('move', () => {
  const bounds = win.getBounds();
});
```

### `enter-full-screen` / `leave-full-screen`

```typescript
win.on('enter-full-screen', () => {});
win.on('leave-full-screen', () => {});
```

### `ready-to-show`

Emitted when content is ready to display. ⚠️ *Not emitted in the current implementation.*

```typescript
const win = new BrowserWindow({ show: false });
win.loadFile('index.html');

win.on('ready-to-show', () => {
  win.show();
});
```

## Properties

### `win.id`

Unique window identifier.

```typescript
console.log(win.id); // 1
```

### `win.webContents`

The window's WebContents instance.

## Examples

### Basic Window

```typescript
const win = new BrowserWindow({
  width: 1200,
  height: 800,
  title: 'My App',
});

win.loadFile('index.html');
```

### Frameless Window

```typescript
const win = new BrowserWindow({
  frame: false,
  transparent: true,
  width: 400,
  height: 300,
});
```

### Modal Dialog

```typescript
const modal = new BrowserWindow({
  parent: mainWindow,
  modal: true,
  width: 400,
  height: 200,
  resizable: false,
});
```

### macOS Title Bar

> Note: `titleBarStyle` and `vibrancy` are not yet implemented.

```typescript
const win = new BrowserWindow({
  titleBarStyle: 'hiddenInset',
  vibrancy: 'sidebar',
});
```

### Remember Window State

```typescript
import { app, BrowserWindow } from 'bunlet';

function createWindow() {
  const bounds = loadWindowState();

  const win = new BrowserWindow({
    ...bounds,
    minWidth: 800,
    minHeight: 600,
  });

  win.on('close', () => {
    saveWindowState(win.getBounds());
  });

  return win;
}

function loadWindowState() {
  try {
    return JSON.parse(
      Bun.file(app.getPath('userData') + '/window-state.json').textSync()
    );
  } catch {
    return { width: 1200, height: 800 };
  }
}

function saveWindowState(bounds: Rectangle) {
  Bun.write(
    app.getPath('userData') + '/window-state.json',
    JSON.stringify(bounds)
  );
}
```

## Related

- [app](app.md)
- [IPC](ipc.md)
- [Window Management Guide](../guides/window-management.md)
