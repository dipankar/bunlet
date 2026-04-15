# Windows

Learn how to create and manage application windows in Bunlet.

## Creating a Window

```typescript
import { BrowserWindow } from 'bunlet';

const win = new BrowserWindow({
  width: 800,
  height: 600,
  title: 'My Window'
});

win.loadFile('index.html');
```

## Window Options

### Size and Position

```typescript
const win = new BrowserWindow({
  width: 1200,           // Initial width
  height: 800,           // Initial height
  x: 100,                // X position
  y: 100,                // Y position
  center: true,          // Center on screen (default)
  minWidth: 400,         // Minimum width
  minHeight: 300,        // Minimum height
  maxWidth: 1920,        // Maximum width
  maxHeight: 1080,       // Maximum height
});
```

### Appearance

```typescript
const win = new BrowserWindow({
  title: 'My App',
  frame: true,           // Show window frame (default: true)
  transparent: false,    // Enable transparency
  backgroundColor: '#fff',
  alwaysOnTop: false,    // Keep on top of other windows
});
```

### Behavior

```typescript
const win = new BrowserWindow({
  show: true,            // Show immediately (default: true)
  resizable: true,       // Allow resizing
  movable: true,         // Allow moving
  minimizable: true,     // Allow minimizing
  maximizable: true,     // Allow maximizing
  closable: true,        // Allow closing
  fullscreen: false,     // Start in fullscreen
  fullscreenable: true,  // Allow fullscreen toggle
});
```

## Loading Content

### From a File

```typescript
win.loadFile('index.html');
win.loadFile('pages/about.html');
```

### From a URL

```typescript
win.loadURL('https://example.com');
win.loadURL('http://localhost:5173');  // Dev server
```

## Window Control

### Visibility

```typescript
win.show();      // Show window
win.hide();      // Hide window
win.focus();     // Focus window
```

### State

```typescript
win.maximize();       // Maximize
win.unmaximize();     // Restore from maximized
win.minimize();       // Minimize
win.restore();        // Restore from minimized
win.setFullScreen(true);   // Enter fullscreen
win.setFullScreen(false);  // Exit fullscreen
```

### Geometry

```typescript
// Get current bounds
const bounds = win.getBounds();
// { x: 100, y: 100, width: 800, height: 600 }

// Set bounds
win.setBounds({ x: 200, y: 200, width: 1024, height: 768 });

// Set size only
win.setSize(1024, 768);

// Set position only
win.setPosition(200, 200);

// Center on screen
win.center();
```

### Properties

```typescript
win.setTitle('New Title');
win.setAlwaysOnTop(true);
win.setBackgroundColor('#f0f0f0');
```

## Window State Checks

```typescript
win.isVisible();     // Is window visible?
win.isFocused();     // Is window focused?
win.isMaximized();   // Is window maximized?
win.isMinimized();   // Is window minimized?
win.isFullScreen();  // Is window fullscreen?
win.isDestroyed();   // Has window been destroyed?
```

## Window Events

```typescript
// Lifecycle events
win.on('close', (event) => {
  // Prevent close
  event.preventDefault();

  // Or allow it to proceed
});

win.on('closed', () => {
  // Window is now destroyed
});

// Visibility events
win.on('show', () => {});
win.on('hide', () => {});
win.on('focus', () => {});
win.on('blur', () => {});

// State events
win.on('maximize', () => {});
win.on('unmaximize', () => {});
win.on('minimize', () => {});
win.on('restore', () => {});
win.on('enter-full-screen', () => {});
win.on('leave-full-screen', () => {});

// Geometry events
win.on('resize', () => {});
win.on('move', () => {});

// Loading events
win.on('did-start-loading', () => {});
win.on('did-finish-load', () => {});
```

## Static Methods

```typescript
// Get all windows
const windows = BrowserWindow.getAllWindows();

// Get focused window
const focused = BrowserWindow.getFocusedWindow();

// Get window by ID
const win = BrowserWindow.fromId(1);
```

## Multiple Windows

```typescript
import { app, BrowserWindow } from 'bunlet';

const windows = new Map<number, BrowserWindow>();

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
  });

  windows.set(win.id, win);

  win.on('closed', () => {
    windows.delete(win.id);
  });

  win.loadFile('index.html');
  return win;
}

await app.whenReady();

// Create initial window
createWindow();

// Create more windows as needed
app.handle('window:new', z.object({}), () => {
  createWindow();
  return true;
});

app.run();
```

## Modal Windows

```typescript
const parent = new BrowserWindow({ width: 800, height: 600 });

const modal = new BrowserWindow({
  width: 400,
  height: 300,
  parent: parent,
  modal: true,
});
```

## Frameless Windows

```typescript
const win = new BrowserWindow({
  frame: false,
  transparent: true,
  backgroundColor: '#00000000',
});
```

For frameless windows, you need to implement custom drag regions in your HTML:

```css
.titlebar {
  -webkit-app-region: drag;
}

.titlebar button {
  -webkit-app-region: no-drag;
}
```

## DevTools

```typescript
// Via WebContents
win.webContents.openDevTools();
win.webContents.closeDevTools();
win.webContents.toggleDevTools();

// Check if open
const isOpen = win.webContents.isDevToolsOpened();
```

## Executing JavaScript

```typescript
// Execute code in the renderer
const result = await win.webContents.executeJavaScript(
  'document.title'
);
```

## Sending Messages

Use `webContents.send()` or `win.send()` to push data to the renderer:

```typescript
// Main process - send via webContents
win.webContents.send('status-update', { status: 'ready', progress: 100 });

// Or shorthand via BrowserWindow
win.send('status-update', { status: 'ready', progress: 100 });
```

```javascript
// Renderer - listen with __bunlet
window.__bunlet.on('status-update', (event, data) => {
  console.log(data.status, data.progress);
});
```

!!! tip

    For production apps, expose typed listeners via a preload script
    instead of using `window.__bunlet.on()` directly. See [Preload Scripts](preload.md).

## Next Steps

- [IPC Communication](ipc.md) - Communication between main and renderer
- [Menus](menus.md) - Adding application menus
- [API Reference: BrowserWindow](../api/browser-window.md)
