# IPC Communication

Learn how to communicate between the main process and renderer in Bunlet.

## Overview

Bunlet uses a JSON-RPC 2.0 based IPC system with Zod schema validation for type-safe communication between processes.

```
┌─────────────────┐         ┌─────────────────┐
│  Main Process   │◄───────►│    Renderer     │
│     (Bun)       │   IPC   │   (WebView)     │
└─────────────────┘         └─────────────────┘
```

There are three ways to communicate:

1. **Renderer → Main**: `window.__bunlet.invoke()` (request/response)
2. **Main → Renderer**: `webContents.send()` (push events)
3. **Preload Bridge**: `contextBridge.exposeInMainWorld()` (secure API surface)

## Defining Handlers

Use `app.handle()` to register IPC handlers in the main process:

```typescript
import { app, z } from '@bunlet/core';

app.handle(
  'greet',
  z.object({ name: z.string() }),
  async (params) => {
    return `Hello, ${params.name}!`;
  }
);
```

### Handler Signature

```typescript
app.handle(
  channel: string,           // Handler name
  schema: ZodSchema,         // Request validation schema
  handler: (params, context) => Promise<Result> | Result
);
```

**`params`**: The validated input matching your Zod schema.

**`context`**: Contains `{ window, windowId }` for accessing the sending window.

```typescript
app.handle('my-handler', schema, async (params, context) => {
  const { window, windowId } = context;

  // Access the window that sent the message
  window.setTitle('Processing...');

  return result;
});
```

### No-Argument Handlers

For handlers that don't need input, use `z.object({})`:

```typescript
app.handle('get-time', z.object({}), async () => {
  return { time: new Date().toISOString() };
});
```

!!! warning "Empty params"

    When calling a no-argument handler from the renderer, always pass an empty
    object as params: `window.__bunlet.invoke({ method: 'get-time', params: {} })`.
    Do not omit `params` or pass `[]` — Zod validates against `z.object({})`
    which expects a plain object.

## Calling from Renderer

### Direct (Simple Apps)

For simple apps, you can call handlers directly via the injected `__bunlet` object:

```javascript
// Simple invoke
const result = await window.__bunlet.invoke({
  method: 'greet',
  params: { name: 'World' }
});

// No-argument invoke
const time = await window.__bunlet.invoke({
  method: 'get-time',
  params: {}
});
```

The `__bunlet` object is injected into every window's JavaScript context before
the page loads. It provides:

- **`invoke({ method, params })`** — Call a handler, returns a Promise
- **`send(channel, ...args)`** — Fire-and-forget message to main process
- **`on(channel, listener)`** — Listen for main-to-renderer messages
- **`off(channel, listener)`** — Remove a listener

### Using a Preload Script (Recommended for Production)

For production apps, expose a curated API surface via a preload script:

```typescript
// preload.ts
import { contextBridge, ipcRenderer } from '@bunlet/core';

contextBridge.exposeInMainWorld('api', {
  // Request/response
  getFiles: () => ipcRenderer.invoke('get-files'),
  openFile: (path: string) => ipcRenderer.invoke('open-file', { path }),

  // Events from main process
  onFileChanged: (callback) => ipcRenderer.on('file-changed', (_event, data) => callback(data)),
});
```

```typescript
// main.ts
const win = new BrowserWindow({
  webPreferences: {
    preload: path.join(import.meta.dir, 'preload.ts'),
  },
});
```

```javascript
// renderer (index.html)
const files = await window.api.getFiles();
await window.api.openFile('/path/to/file');

window.api.onFileChanged((data) => {
  console.log('File changed:', data);
});
```

See [Preload Scripts](preload.md) for the full guide.

## Schema Validation with Zod

Bunlet uses [Zod](https://zod.dev) for request validation:

```typescript
import { app, z } from '@bunlet/core';

// Simple types
app.handle('simple', z.object({
  name: z.string(),
  age: z.number(),
  active: z.boolean(),
}), async (params) => {
  // params is typed as { name: string, age: number, active: boolean }
});

// Optional fields
app.handle('optional', z.object({
  required: z.string(),
  optional: z.string().optional(),
  withDefault: z.number().default(0),
}), async (params) => {});

// Arrays and nested objects
app.handle('complex', z.object({
  items: z.array(z.string()),
  metadata: z.object({
    key: z.string(),
    value: z.unknown(),
  }),
}), async (params) => {});

// Enums
app.handle('enum', z.object({
  status: z.enum(['pending', 'active', 'completed']),
}), async (params) => {});
```

## Error Handling

### In Handlers

```typescript
app.handle('risky', schema, async (params) => {
  if (!isValid(params)) {
    throw new Error('Invalid input');
  }

  try {
    return await doSomething(params);
  } catch (error) {
    throw new Error(`Operation failed: ${error.message}`);
  }
});
```

### In Renderer

```javascript
try {
  const result = await window.__bunlet.invoke({
    method: 'risky',
    params: { data: 'test' }
  });
} catch (error) {
  console.error('Handler error:', error.message);
}
```

### Error Codes

| Code | Description |
|------|-------------|
| -32601 | Method not found |
| -32602 | Invalid params (validation failed) |
| -32000 | Server error (handler threw) |

## Sending from Main to Renderer

Use `webContents.send()` to push messages to the renderer:

```typescript
// Main process
import { BrowserWindow } from '@bunlet/core';

const win = new BrowserWindow();
win.loadFile('index.html');

// Push an event to the renderer
win.webContents.send('notification', {
  title: 'Update',
  message: 'New data available'
});
```

```javascript
// Renderer - listen for the event
window.__bunlet.on('notification', (event, data) => {
  console.log('Notification:', data.title, data.message);
  // => "Notification: Update New data available"
});
```

### Typing Events with Preload

For better type safety, expose typed event listeners:

```typescript
// preload.ts
import { contextBridge, ipcRenderer } from '@bunlet/core';

contextBridge.exposeInMainWorld('api', {
  onNotification: (callback) =>
    ipcRenderer.on('notification', (_event, data) => callback(data)),
});
```

```javascript
// renderer
window.api.onNotification((data) => {
  showNotification(data.title, data.message);
});
```

## Patterns

### File Operations

```typescript
import * as fs from 'fs';

app.handle('file:read', z.object({
  path: z.string(),
}), async (params) => {
  return fs.readFileSync(params.path, 'utf-8');
});

app.handle('file:write', z.object({
  path: z.string(),
  content: z.string(),
}), async (params) => {
  fs.writeFileSync(params.path, params.content);
  return { success: true };
});
```

### Settings/Storage

```typescript
const settings = new Map<string, unknown>();

app.handle('settings:get', z.object({
  key: z.string(),
}), async (params) => {
  return settings.get(params.key);
});

app.handle('settings:set', z.object({
  key: z.string(),
  value: z.unknown(),
}), async (params) => {
  settings.set(params.key, params.value);
  return { success: true };
});
```

### Window Operations

```typescript
app.handle('window:minimize', z.object({}), async (params, context) => {
  context.window.minimize();
  return { success: true };
});

app.handle('window:maximize', z.object({}), async (params, context) => {
  if (context.window.isMaximized()) {
    context.window.unmaximize();
  } else {
    context.window.maximize();
  }
  return { maximized: context.window.isMaximized() };
});
```

## Removing Handlers

```typescript
// Remove a specific handler
app.removeHandler('my-handler');
```

## Best Practices

### 1. Group Related Handlers

```typescript
// handlers/files.ts
export function registerFileHandlers() {
  app.handle('file:read', ...);
  app.handle('file:write', ...);
  app.handle('file:delete', ...);
}

// handlers/index.ts
import { registerFileHandlers } from './files';
import { registerSettingsHandlers } from './settings';

export function registerAllHandlers() {
  registerFileHandlers();
  registerSettingsHandlers();
}
```

### 2. Use Namespaced Channels

```typescript
// Good
app.handle('file:read', ...);
app.handle('file:write', ...);
app.handle('settings:get', ...);

// Avoid
app.handle('readFile', ...);
app.handle('writeFile', ...);
app.handle('getSettings', ...);
```

### 3. Return Consistent Types

```typescript
interface FileResult {
  success: boolean;
  data?: string;
  error?: string;
}

app.handle('file:read', schema, async (params): Promise<FileResult> => {
  try {
    const data = fs.readFileSync(params.path, 'utf-8');
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
```

### 4. Use Preload Scripts for Production

Always use `contextBridge.exposeInMainWorld()` in production apps instead of
accessing `window.__bunlet` directly from the renderer. This provides:

- A curated, type-safe API surface
- Better security (no direct access to IPC bridge)
- Cleaner renderer code
- Automatic cleanup of event listeners

See [Preload Scripts](preload.md) for the full guide.

## Next Steps

- [Preload Scripts](preload.md) - Secure API exposure with contextBridge
- [Windows Guide](windows.md) - Window management
- [API Reference: app](../api/app.md) - Full app API