# app

The `app` module controls your application's lifecycle and provides system integration.

```typescript
import { app } from 'bunlet';
```

## Methods

### `whenReady()`

Wait for the app to be initialized.

```typescript
await app.whenReady();
```

**Returns:** `Promise<void>`

---

### `isReady()`

Check if the app is initialized.

```typescript
if (app.isReady()) {
  // App is ready
}
```

**Returns:** `boolean`

---

### `run()`

Start the event loop. This is a blocking call.

```typescript
app.run();
```

!!! warning
    All window creation and handler registration must happen before calling `app.run()`.

---

### `quit()`

Quit the application with lifecycle events.

```typescript
app.quit();
```

Emits `before-quit`, `will-quit`, and `quit` events.

---

### `exit(exitCode?)`

Exit immediately without lifecycle events.

```typescript
app.exit(0);
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `exitCode` | `number` | `0` | Exit code |

---

### `handle(channel, schema, handler)`

Register an IPC handler.

```typescript
app.handle(
  'greet',
  z.object({ name: z.string() }),
  async ({ name }, context) => {
    return `Hello, ${name}!`;
  }
);
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `channel` | `string` | Handler name |
| `schema` | `ZodSchema` | Request validation schema |
| `handler` | `Function` | Handler function |

**Handler signature:**
```typescript
(params: T, context: IPCContext) => Promise<Result> | Result
```

**IPCContext:**
```typescript
interface IPCContext {
  window: BrowserWindow;
  windowId: number;
}
```

---

### `removeHandler(channel)`

Remove an IPC handler.

```typescript
app.removeHandler('greet');
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `channel` | `string` | Handler name |

---

### `getName()`

Get the application name.

```typescript
const name = app.getName();
```

**Returns:** `string`

---

### `setName(name)`

Set the application name.

```typescript
app.setName('My App');
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | `string` | Application name |

---

### `getVersion()`

Get the application version from package.json.

```typescript
const version = app.getVersion();
```

**Returns:** `string`

---

### `getLocale()`

Get the system locale.

```typescript
const locale = app.getLocale();
// e.g., 'en-US'
```

**Returns:** `string`

---

### `getAppPath()`

Get the current working directory.

```typescript
const appPath = app.getAppPath();
```

**Returns:** `string`

---

### `getPath(name)`

Get a standard system path.

```typescript
const downloads = app.getPath('downloads');
const documents = app.getPath('documents');
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | `PathName` | Path type |

**Path names:**

| Name | Description |
|------|-------------|
| `home` | User home directory |
| `appData` | Per-user app data |
| `userData` | App-specific user data |
| `temp` | Temporary directory |
| `exe` | Executable path |
| `desktop` | Desktop directory |
| `documents` | Documents directory |
| `downloads` | Downloads directory |
| `music` | Music directory |
| `pictures` | Pictures directory |
| `videos` | Videos directory |

**Returns:** `string`

## Events

### `ready`

Emitted when the app is initialized.

```typescript
app.on('ready', () => {
  console.log('App is ready');
});
```

---

### `before-quit`

Emitted before the app starts quitting.

```typescript
app.on('before-quit', (event) => {
  // Prevent quit
  event.preventDefault();
});
```

---

### `will-quit`

Emitted when all windows are closed and the app will quit.

```typescript
app.on('will-quit', () => {
  // Cleanup
});
```

---

### `quit`

Emitted when the app has quit.

```typescript
app.on('quit', () => {
  console.log('App quit');
});
```

---

### `window-all-closed`

Emitted when all windows are closed.

```typescript
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
```

## Properties

### `isQuitting`

Whether the app is in the process of quitting.

```typescript
if (app.isQuitting) {
  // Don't prevent window close
}
```

**Type:** `boolean`

## Example

```typescript
import { app, BrowserWindow, z } from 'bunlet';

// Register handlers
app.handle('get-version', z.object({}), () => {
  return app.getVersion();
});

// Handle lifecycle
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Wait for ready
await app.whenReady();

// Create window
const win = new BrowserWindow({ width: 800, height: 600 });
win.loadFile('index.html');

// Start event loop
app.run();
```
