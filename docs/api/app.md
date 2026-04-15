# app

The `app` module controls your application's lifecycle.

```typescript
import { app } from 'bunlet';
```

## Methods

### `app.whenReady()`

Returns a Promise that resolves when the app is ready.

```typescript
app.whenReady(): Promise<void>
```

**Example:**
```typescript
app.whenReady().then(() => {
  createWindow();
});

// Or with async/await
await app.whenReady();
createWindow();
```

### `app.quit()`

Attempts to close all windows and quit the application.

```typescript
app.quit(): void
```

Windows receive the `close` event and can prevent quit with `event.preventDefault()`.

### `app.exit(exitCode?)`

Exits immediately without closing windows.

```typescript
app.exit(exitCode?: number): void
```

**Parameters:**
- `exitCode` - Exit code (default: 0)

### `app.relaunch(options?)`

Relaunches the app when current instance exits.

```typescript
app.relaunch(options?: {
  args?: string[];
  execPath?: string;
}): void
```

**Example:**
```typescript
app.relaunch({ args: ['--restarted'] });
app.quit();
```

### `app.isReady()`

Returns whether the app is ready.

```typescript
app.isReady(): boolean
```

### `app.focus(options?)`

Focuses the application.

```typescript
app.focus(options?: { steal: boolean }): void ⚠️ *(Not yet implemented)*
```

On macOS, activates the app. Use `steal: true` to focus even if another app has focus.

### `app.hide()` (macOS)

Hides all application windows.

```typescript
app.hide(): void ⚠️ *(Not yet implemented)*
```

### `app.show()` (macOS)

Shows application windows after they were hidden.

```typescript
app.show(): void ⚠️ *(Not yet implemented)*
```

### `app.getName()`

Returns the application name.

```typescript
app.getName(): string
```

### `app.setName(name)`

Sets the application name.

```typescript
app.setName(name: string): void
```

### `app.getVersion()`

Returns the version from `bunlet.config.ts` or `package.json`.

```typescript
app.getVersion(): string
```

### `app.getPath(name)`

Returns a path to a special directory.

```typescript
app.getPath(name: PathName): string
```

**Path names:**
- `home` - User's home directory
- `appData` - Per-user application data
- `userData` - App-specific data directory
- `temp` - Temporary files
- `desktop` - Desktop directory
- `documents` - Documents directory
- `downloads` - Downloads directory
- `music` - Music directory
- `pictures` - Pictures directory
- `videos` - Videos directory
- `logs` - Log files directory **(NOT supported)**

> **Note:** The paths `exe`, `cache`, `data`, `dataLocal`, and `runtime` ARE supported but not listed above.

**Example:**
```typescript
const configPath = app.getPath('userData');
// macOS: ~/Library/Application Support/YourApp
// Windows: %APPDATA%/YourApp
// Linux: ~/.config/yourapp
```

### `app.setPath(name, path)`

Overrides a special directory path.

```typescript
app.setPath(name: PathName, path: string): void ⚠️ *(Not yet implemented)*
```

### `app.getAppPath()`

Returns the current application directory.

```typescript
app.getAppPath(): string
```

### `app.getLocale()`

Returns the current system locale.

```typescript
app.getLocale(): string
// Returns: 'en-US', 'de-DE', etc.
```

### `app.requestSingleInstanceLock()`

Makes your app a single instance application.

```typescript
app.requestSingleInstanceLock(additionalData?: object): boolean ⚠️ *(Not yet implemented)*
```

Returns `true` if lock was obtained.

**Example:**
```typescript
const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (event, argv, workingDir, additionalData) => {
    // Focus main window when second instance launched
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}
```

### `app.hasSingleInstanceLock()`

Returns whether app has the single instance lock.

```typescript
app.hasSingleInstanceLock(): boolean ⚠️ *(Not yet implemented)*
```

### `app.releaseSingleInstanceLock()`

Releases the single instance lock.

```typescript
app.releaseSingleInstanceLock(): void ⚠️ *(Not yet implemented)*
```

### `app.handle(command, schema, handler)`

Registers an IPC handler.

```typescript
app.handle<T, R>(
  command: string,
  schema: ZodSchema<T>,
  handler: (args: T, context: IPCContext) => Promise<R>
): void
```

**Parameters:**
- `command` - Command name
- `schema` - Zod schema for validation
- `handler` - Async handler function

**Example:**
```typescript
import { z } from 'zod';

app.handle('fs:read',
  z.object({ path: z.string() }),
  async ({ path }) => {
    return await Bun.file(path).text();
  }
);
```

## Events

### `ready`

Emitted when app is ready.

```typescript
app.on('ready', () => {
  createWindow();
});
```

### `window-all-closed`

Emitted when all windows are closed.

```typescript
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
```

### `before-quit`

Emitted before windows start closing. Can be prevented.

```typescript
app.on('before-quit', (event) => {
  if (hasUnsavedChanges) {
    event.preventDefault();
  }
});
```

### `will-quit`

Emitted when all windows are closed and app will quit. Cannot be prevented.

```typescript
app.on('will-quit', () => {
  // Cleanup
});
```

### `quit`

Emitted when the application has quit.

```typescript
app.on('quit', (event, exitCode) => {
  console.log('App quit with code:', exitCode);
});
```

### `activate` (macOS)

Emitted when app is activated (dock icon clicked). ⚠️ *May not fire on all platforms yet*

```typescript
app.on('activate', (event, hasVisibleWindows) => {
  if (!hasVisibleWindows) {
    createWindow();
  }
});
```

### `open-file` (macOS)

Emitted when a file is opened with the app. ⚠️ *May not fire on all platforms yet*

```typescript
app.on('open-file', (event, path) => {
  openFile(path);
});
```

### `open-url` (macOS)

Emitted when a URL is opened with the app. ⚠️ *May not fire on all platforms yet*

```typescript
app.on('open-url', (event, url) => {
  handleDeepLink(url);
});
```

### `second-instance`

Emitted when a second instance is launched.

```typescript
app.on('second-instance', (event, argv, workingDirectory, additionalData) => {
  mainWindow.focus();
});
```

## Properties

### `app.isPackaged`

Whether the app is packaged (vs running in development). ⚠️ *(Not yet implemented)*

```typescript
if (app.isPackaged) {
  // Production mode
} else {
  // Development mode
}
```

### `app.name`

The application name.

```typescript
console.log(app.name); // 'My App'
```

### `app.version`

The application version.

```typescript
console.log(app.version); // '1.0.0'
```

## Example

```typescript
import { app, BrowserWindow } from 'bunlet';
import { z } from 'zod';

let mainWindow: BrowserWindow | null = null;

// Single instance lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// IPC handlers
app.handle('get-version', z.object({}), async () => {
  return app.getVersion();
});

// App ready
app.whenReady().then(() => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
  });

  mainWindow.loadFile('index.html');
});

// Window management
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});
```

## Related

- [BrowserWindow](browser-window.md)
- [IPC](ipc.md)
- [Quick Start](../getting-started/quick-start.md)
