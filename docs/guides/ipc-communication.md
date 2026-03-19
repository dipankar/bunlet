# IPC Communication Guide

This guide covers patterns and best practices for communication between main and renderer processes.

## Basic Pattern

### 1. Define Handler in Main

```typescript
// main.ts
import { app } from 'bunlet';
import { z } from 'zod';

app.handle('greet',
  z.object({ name: z.string() }),
  async ({ name }) => {
    return `Hello, ${name}!`;
  }
);
```

### 2. Expose in Preload

```typescript
// preload.ts
import { contextBridge, ipcRenderer } from 'bunlet/renderer';

contextBridge.exposeInMainWorld('api', {
  greet: (name: string) => ipcRenderer.invoke('greet', { name }),
});
```

### 3. Use in Renderer

```typescript
// renderer.ts
const message = await window.api.greet('World');
console.log(message); // "Hello, World!"
```

## Common Patterns

### File Operations

```typescript
// main.ts
app.handle('fs:read',
  z.object({ path: z.string() }),
  async ({ path }) => {
    const file = Bun.file(path);
    if (!await file.exists()) {
      throw new Error(`File not found: ${path}`);
    }
    return await file.text();
  }
);

app.handle('fs:write',
  z.object({ path: z.string(), content: z.string() }),
  async ({ path, content }) => {
    await Bun.write(path, content);
    return { success: true, path };
  }
);

app.handle('fs:exists',
  z.object({ path: z.string() }),
  async ({ path }) => {
    return await Bun.file(path).exists();
  }
);
```

```typescript
// preload.ts
contextBridge.exposeInMainWorld('fs', {
  read: (path: string) => ipcRenderer.invoke('fs:read', { path }),
  write: (path: string, content: string) =>
    ipcRenderer.invoke('fs:write', { path, content }),
  exists: (path: string) => ipcRenderer.invoke('fs:exists', { path }),
});
```

### Database Operations

```typescript
// main.ts
import { Database } from 'bun:sqlite';

const db = new Database('app.db');

app.handle('db:query',
  z.object({
    sql: z.string(),
    params: z.array(z.unknown()).optional()
  }),
  async ({ sql, params = [] }) => {
    return db.query(sql).all(...params);
  }
);

app.handle('db:run',
  z.object({
    sql: z.string(),
    params: z.array(z.unknown()).optional()
  }),
  async ({ sql, params = [] }) => {
    return db.run(sql, ...params);
  }
);
```

### System Information

```typescript
// main.ts
import os from 'os';

app.handle('system:info',
  z.object({}),
  async () => ({
    platform: process.platform,
    arch: process.arch,
    hostname: os.hostname(),
    cpus: os.cpus().length,
    memory: {
      total: os.totalmem(),
      free: os.freemem(),
    },
  })
);
```

### Dialog Integration

```typescript
// main.ts
import { dialog } from 'bunlet';

app.handle('dialog:open',
  z.object({
    title: z.string().optional(),
    filters: z.array(z.object({
      name: z.string(),
      extensions: z.array(z.string())
    })).optional(),
    multiple: z.boolean().optional()
  }),
  async (options, context) => {
    const result = await dialog.showOpenDialog(context.window, {
      title: options.title,
      filters: options.filters,
      properties: options.multiple
        ? ['openFile', 'multiSelections']
        : ['openFile']
    });
    return result.canceled ? null : result.filePaths;
  }
);

app.handle('dialog:save',
  z.object({
    title: z.string().optional(),
    defaultPath: z.string().optional(),
    filters: z.array(z.object({
      name: z.string(),
      extensions: z.array(z.string())
    })).optional()
  }),
  async (options, context) => {
    const result = await dialog.showSaveDialog(context.window, options);
    return result.canceled ? null : result.filePath;
  }
);

app.handle('dialog:message',
  z.object({
    type: z.enum(['info', 'warning', 'error', 'question']).optional(),
    title: z.string(),
    message: z.string(),
    buttons: z.array(z.string()).optional()
  }),
  async (options, context) => {
    const result = await dialog.showMessageBox(context.window, {
      type: options.type ?? 'info',
      title: options.title,
      message: options.message,
      buttons: options.buttons ?? ['OK']
    });
    return result.response;
  }
);
```

## Bidirectional Communication

### Main to Renderer

```typescript
// main.ts
import { BrowserWindow } from 'bunlet';

function notifyRenderer(data: any) {
  const windows = BrowserWindow.getAllWindows();
  windows.forEach(win => {
    win.send('notification', data);
  });
}

// Usage
notifyRenderer({ type: 'update', version: '2.0.0' });
```

```typescript
// preload.ts
contextBridge.exposeInMainWorld('events', {
  onNotification: (callback: (data: any) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('notification', handler);
    return () => ipcRenderer.off('notification', handler);
  },
});
```

```typescript
// renderer.ts (React example)
import { useEffect, useState } from 'react';

function App() {
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    const unsubscribe = window.events.onNotification((data) => {
      setNotification(data);
    });

    return unsubscribe;
  }, []);

  return notification && <Alert>{notification.message}</Alert>;
}
```

### Progress Reporting

```typescript
// main.ts
app.handle('download',
  z.object({ url: z.string() }),
  async ({ url }, context) => {
    const response = await fetch(url);
    const total = parseInt(response.headers.get('content-length') || '0');
    const reader = response.body!.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(value);
      received += value.length;

      // Report progress to renderer
      context.window.send('download:progress', {
        received,
        total,
        percent: Math.round((received / total) * 100)
      });
    }

    return new Blob(chunks);
  }
);
```

## Error Handling

### Structured Errors

```typescript
// main.ts
class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

app.handle('operation',
  z.object({}),
  async () => {
    throw new AppError('NOT_FOUND', 'Resource not found', { id: 123 });
  }
);
```

```typescript
// renderer.ts
try {
  await window.api.operation();
} catch (error) {
  if (error.code === 'NOT_FOUND') {
    showNotFoundMessage(error.details.id);
  } else {
    showGenericError(error.message);
  }
}
```

### Validation Errors

Zod validation errors are automatically formatted:

```typescript
app.handle('create-user',
  z.object({
    email: z.string().email(),
    age: z.number().min(0).max(150)
  }),
  async (user) => {
    // This only runs if validation passes
  }
);

// In renderer, invalid input throws:
// "email: Invalid email format, age: Number must be at least 0"
```

## Type Safety

### Shared Types

```typescript
// shared/types.ts
export interface User {
  id: string;
  name: string;
  email: string;
}

export interface CreateUserInput {
  name: string;
  email: string;
}
```

```typescript
// main.ts
import { User, CreateUserInput } from './shared/types';

app.handle('users:create',
  z.object({
    name: z.string().min(1),
    email: z.string().email()
  }),
  async (input: CreateUserInput): Promise<User> => {
    const user = await db.createUser(input);
    return user;
  }
);
```

```typescript
// preload.ts
import type { User, CreateUserInput } from './shared/types';

contextBridge.exposeInMainWorld('api', {
  createUser: (input: CreateUserInput): Promise<User> =>
    ipcRenderer.invoke('users:create', input),
});

declare global {
  interface Window {
    api: {
      createUser(input: CreateUserInput): Promise<User>;
    };
  }
}
```

## Performance Tips

### Batch Operations

```typescript
// Instead of many calls:
for (const id of ids) {
  await window.api.getItem(id); // N round trips
}

// Use batch handler:
app.handle('items:batch',
  z.object({ ids: z.array(z.string()) }),
  async ({ ids }) => {
    return await db.getItems(ids); // 1 round trip
  }
);

const items = await window.api.getItems(ids);
```

### Streaming Large Data

```typescript
// For large files, stream instead of loading all at once
app.handle('file:stream',
  z.object({ path: z.string() }),
  async ({ path }, context) => {
    const file = Bun.file(path);
    const stream = file.stream();
    const reader = stream.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      context.window.send('file:chunk', { data: value });
    }

    context.window.send('file:complete');
  }
);
```

### Debounce Frequent Calls

```typescript
// preload.ts
import { debounce } from 'lodash';

const debouncedSave = debounce(
  (content: string) => ipcRenderer.invoke('save', { content }),
  1000
);

contextBridge.exposeInMainWorld('editor', {
  save: debouncedSave,
});
```

## Security

### Never Expose Raw IPC

```typescript
// ❌ DON'T do this
contextBridge.exposeInMainWorld('ipc', {
  invoke: ipcRenderer.invoke,
  send: ipcRenderer.send,
});

// ✅ DO expose specific methods
contextBridge.exposeInMainWorld('api', {
  getUser: (id: string) => ipcRenderer.invoke('users:get', { id }),
  updateUser: (id: string, data: UserUpdate) =>
    ipcRenderer.invoke('users:update', { id, data }),
});
```

### Validate Everything

```typescript
// Always use Zod schemas
app.handle('update',
  z.object({
    id: z.string().uuid(),
    data: z.object({
      name: z.string().max(100),
      email: z.string().email(),
    }),
  }),
  async ({ id, data }) => {
    // Input is validated and typed
  }
);
```

### Sanitize Paths

```typescript
import path from 'path';

app.handle('fs:read',
  z.object({ path: z.string() }),
  async ({ path: filePath }) => {
    // Prevent directory traversal
    const safePath = path.resolve(app.getPath('userData'), filePath);
    if (!safePath.startsWith(app.getPath('userData'))) {
      throw new Error('Access denied');
    }
    return await Bun.file(safePath).text();
  }
);
```

## Related

- [IPC API Reference](../api/ipc.md)
- [Security Guide](../advanced/security.md)
- [Preload Scripts](preload-scripts.md)
