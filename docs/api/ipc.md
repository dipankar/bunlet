# IPC (Inter-Process Communication)

Bunlet uses IPC to communicate between the main process and renderer.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Main Process (Bun)                       │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                   app.handle()                       │    │
│  │            Command Handlers Registry                 │    │
│  └─────────────────────────────────────────────────────┘    │
│                            ↑ ↓                              │
│                    JSON-RPC Messages                        │
│                            ↑ ↓                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                   Preload Script                     │    │
│  │          contextBridge.exposeInMainWorld()          │    │
│  └─────────────────────────────────────────────────────┘    │
│                            ↑ ↓                              │
└─────────────────────────────────────────────────────────────┘
                             ↑ ↓
┌─────────────────────────────────────────────────────────────┐
│                    Renderer (WebView)                        │
│           window.api.someMethod() → invoke()                 │
└─────────────────────────────────────────────────────────────┘
```

## Main Process

### `app.handle(command, schema, handler)`

Registers an IPC handler.

```typescript
import { app } from '@bunlet/core';
import { z } from 'zod';

app.handle(
  'command-name',          // Command name
  z.object({ ... }),       // Zod schema for validation
  async (args, context) => {  // Handler function
    return result;
  }
);
```

**Parameters:**
- `command` - Unique command identifier
- `schema` - Zod schema for input validation
- `handler` - Async function that processes the request

**Context object:**
```typescript
interface IPCContext {
  window: BrowserWindow;  // Calling window
  windowId: number;    // ID of the calling window
}
```

### Examples

```typescript
import { app, dialog } from '@bunlet/core';
import { z } from 'zod';

// Simple handler
app.handle('get-version', z.object({}), async () => {
  return app.getVersion();
});

// With arguments
app.handle('fs:read',
  z.object({
    path: z.string(),
    encoding: z.enum(['utf-8', 'binary']).optional()
  }),
  async ({ path, encoding = 'utf-8' }) => {
    return await Bun.file(path).text();
  }
);

// With context
app.handle('show-dialog',
  z.object({ title: z.string() }),
  async ({ title }, context) => {
    // Use calling window as parent
    return await dialog.showMessageBox(context.window, {
      title,
      message: 'Hello!',
      buttons: ['OK']
    });
  }
);

// Error handling
app.handle('risky-operation',
  z.object({}),
  async () => {
    try {
      return await doSomethingRisky();
    } catch (error) {
      throw new Error('Operation failed: ' + error.message);
    }
  }
);
```

### `win.send(channel, ...args)`

Sends a message from main to renderer.

```typescript
// In main process
win.send('update-data', { count: 42 });

// Multiple windows
BrowserWindow.getAllWindows().forEach(win => {
  win.send('broadcast', data);
});
```

## Preload Script

The preload script bridges main and renderer safely.

### `contextBridge.exposeInMainWorld(key, api)`

Exposes APIs to the renderer's `window` object.

```typescript
// preload.ts
import { contextBridge, ipcRenderer } from '@bunlet/core';

contextBridge.exposeInMainWorld('api', {
  // Invoke main process handlers
  readFile: (path: string) =>
    ipcRenderer.invoke('fs:read', { path }),

  writeFile: (path: string, content: string) =>
    ipcRenderer.invoke('fs:write', { path, content }),

  // One-way messages
  log: (message: string) =>
    ipcRenderer.send('log', message),

  // Listen for main process events
  onUpdate: (callback: (data: any) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('update-data', handler);
    return () => ipcRenderer.off('update-data', handler);
  },

  // Expose constants
  platform: process.platform,
  version: process.versions.bun,
});
```

### `ipcRenderer.invoke(channel, args)`

Calls a main process handler and returns a Promise.

```typescript
const result = await ipcRenderer.invoke('command-name', { arg1: 'value' });
```

### `ipcRenderer.send(channel, ...args)`

Sends a one-way message (no response).

```typescript
ipcRenderer.send('log', 'Something happened');
```

### `ipcRenderer.on(channel, listener)`

Listens for messages from main process.

```typescript
ipcRenderer.on('update', (event, data) => {
  console.log('Received:', data);
});
```

### `ipcRenderer.off(channel, listener)`

Removes a listener.

```typescript
ipcRenderer.off('update', listener);
```

## Renderer

### Accessing Exposed APIs

```typescript
// In renderer (after preload exposes 'api')
const content = await window.api.readFile('/path/to/file');

// Listen for events
const unsubscribe = window.api.onUpdate((data) => {
  console.log('Update:', data);
});

// Later: cleanup
unsubscribe();
```

### TypeScript Support

Declare types for exposed APIs:

```typescript
// preload.ts
declare global {
  interface Window {
    api: {
      readFile(path: string): Promise<string>;
      writeFile(path: string, content: string): Promise<void>;
      onUpdate(callback: (data: UpdateData) => void): () => void;
      platform: NodeJS.Platform;
      version: string;
    };
  }
}

// Now renderer has type checking
const content = await window.api.readFile('/path'); // typed!
```

## Message Protocol

Bunlet uses JSON-RPC 2.0 internally:

```typescript
// Request
{
  jsonrpc: '2.0',
  id: 'unique-id',
  method: 'fs:read',
  params: { path: '/file.txt' }
}

// Success response
{
  jsonrpc: '2.0',
  id: 'unique-id',
  result: 'file contents'
}

// Error response
{
  jsonrpc: '2.0',
  id: 'unique-id',
  error: {
    code: -32000,
    message: 'File not found',
    data: { path: '/file.txt' }
  }
}
```

## Error Handling

### In Handlers

```typescript
app.handle('risky',
  z.object({}),
  async () => {
    // Thrown errors become IPC errors
    throw new Error('Something went wrong');
  }
);
```

### In Renderer

```typescript
try {
  await window.api.riskyOperation();
} catch (error) {
  console.error('IPC error:', error.message);
}
```

### Validation Errors

Invalid arguments throw automatically:

```typescript
app.handle('greet',
  z.object({ name: z.string().min(1) }),
  async ({ name }) => `Hello, ${name}!`
);

// In renderer:
await window.api.greet({ name: '' });
// Error: "name: String must contain at least 1 character(s)"
```

## Best Practices

### 1. Use Specific Command Names

```typescript
// Good: Namespaced commands
app.handle('fs:read', ...);
app.handle('fs:write', ...);
app.handle('db:query', ...);

// Avoid: Generic names
app.handle('read', ...);
app.handle('do-thing', ...);
```

### 2. Validate All Input

```typescript
// Always use Zod schemas
app.handle('update-settings',
  z.object({
    theme: z.enum(['light', 'dark']),
    fontSize: z.number().min(8).max(72),
  }),
  async (settings) => {
    // Input is validated and typed
  }
);
```

### 3. Limit Exposed APIs

```typescript
// preload.ts
contextBridge.exposeInMainWorld('api', {
  // Only expose what renderer needs
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings) => ipcRenderer.invoke('settings:update', settings),

  // DON'T expose raw invoke
  // invoke: ipcRenderer.invoke  // ❌ Security risk
});
```

### 4. Clean Up Listeners

```typescript
// preload.ts
contextBridge.exposeInMainWorld('api', {
  onUpdate: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('update', handler);
    // Return cleanup function
    return () => ipcRenderer.off('update', handler);
  },
});

// renderer.ts
useEffect(() => {
  const unsubscribe = window.api.onUpdate(handleUpdate);
  return unsubscribe; // Cleanup on unmount
}, []);
```

### 5. Use Context for Window Access

```typescript
app.handle('close-window',
  z.object({}),
  async (_, context) => {
    context.window.close();
  }
);
```

## Complete Example

### main.ts

```typescript
import { app, BrowserWindow, dialog } from '@bunlet/core';
import { z } from 'zod';

app.handle('fs:read',
  z.object({ path: z.string() }),
  async ({ path }) => {
    return await Bun.file(path).text();
  }
);

app.handle('fs:write',
  z.object({ path: z.string(), content: z.string() }),
  async ({ path, content }) => {
    await Bun.write(path, content);
  }
);

app.handle('dialog:open',
  z.object({ title: z.string().optional() }),
  async ({ title }, context) => {
    const result = await dialog.showOpenDialog(context.window, {
      title,
      properties: ['openFile'],
    });
    return result.filePaths[0] ?? null;
  }
);

app.whenReady().then(() => {
  const win = new BrowserWindow({
    webPreferences: { preload: './preload.ts' },
  });
  win.loadFile('index.html');
});
```

### preload.ts

```typescript
import { contextBridge, ipcRenderer } from '@bunlet/core';

contextBridge.exposeInMainWorld('api', {
  readFile: (path: string) =>
    ipcRenderer.invoke('fs:read', { path }),

  writeFile: (path: string, content: string) =>
    ipcRenderer.invoke('fs:write', { path, content }),

  openFile: (title?: string) =>
    ipcRenderer.invoke('dialog:open', { title }),
});

declare global {
  interface Window {
    api: {
      readFile(path: string): Promise<string>;
      writeFile(path: string, content: string): Promise<void>;
      openFile(title?: string): Promise<string | null>;
    };
  }
}
```

### renderer.ts

```typescript
document.getElementById('open-btn')?.addEventListener('click', async () => {
  const path = await window.api.openFile('Select a file');
  if (path) {
    const content = await window.api.readFile(path);
    document.getElementById('content')!.textContent = content;
  }
});
```

## Related

- [app](app.md)
- [BrowserWindow](browser-window.md)
- [IPC Guide](../guides/ipc-communication.md)
- [Security](../advanced/security.md)
