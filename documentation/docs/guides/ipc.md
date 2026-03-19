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

## Defining Handlers

Use `app.handle()` to register IPC handlers in the main process:

```typescript
import { app, z } from 'bunlet';

app.handle(
  'greet',
  z.object({ name: z.string() }),
  async ({ name }) => {
    return `Hello, ${name}!`;
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

### Handler Context

The handler receives a context object with useful information:

```typescript
app.handle('my-handler', schema, async (params, context) => {
  const { window, windowId } = context;

  // Access the window that sent the message
  window.setTitle('Processing...');

  return result;
});
```

## Calling from Renderer

Use the built-in IPC bridge to call handlers:

```javascript
// Using the __bunlet bridge
async function invoke(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = Math.random().toString(36).substring(7);

    window.__bunlet.onMessage((response) => {
      const parsed = JSON.parse(response);
      if (parsed.id === id) {
        if (parsed.error) {
          reject(new Error(parsed.error.message));
        } else {
          resolve(parsed.result);
        }
      }
    });

    window.__bunlet.invoke({
      jsonrpc: '2.0',
      id,
      method,
      params,
    });
  });
}

// Usage
const greeting = await invoke('greet', { name: 'World' });
```

## Schema Validation with Zod

Bunlet uses [Zod](https://zod.dev) for request validation:

```typescript
import { app, z } from 'bunlet';

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
  const result = await invoke('risky', { data: 'test' });
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

## Patterns

### File Operations

```typescript
import * as fs from 'fs';

app.handle('file:read', z.object({
  path: z.string(),
}), async ({ path }) => {
  return fs.readFileSync(path, 'utf-8');
});

app.handle('file:write', z.object({
  path: z.string(),
  content: z.string(),
}), async ({ path, content }) => {
  fs.writeFileSync(path, content);
  return true;
});
```

### Settings/Storage

```typescript
const settings = new Map<string, unknown>();

app.handle('settings:get', z.object({
  key: z.string(),
}), async ({ key }) => {
  return settings.get(key);
});

app.handle('settings:set', z.object({
  key: z.string(),
  value: z.unknown(),
}), async ({ key, value }) => {
  settings.set(key, value);
  return true;
});
```

### Window Operations

```typescript
app.handle('window:minimize', z.object({}), async (_, { window }) => {
  window.minimize();
  return true;
});

app.handle('window:maximize', z.object({}), async (_, { window }) => {
  if (window.isMaximized()) {
    window.unmaximize();
  } else {
    window.maximize();
  }
  return window.isMaximized();
});
```

## Removing Handlers

```typescript
// Remove a specific handler
app.removeHandler('my-handler');
```

## Sending from Main to Renderer

Use `window.send()` to push messages to the renderer:

```typescript
// Main process
const win = new BrowserWindow();
win.send('notification', {
  title: 'Update',
  message: 'New data available'
});
```

```javascript
// Renderer
window.__bunlet.onMessage((data) => {
  const parsed = JSON.parse(data);
  if (parsed.channel === 'notification') {
    showNotification(parsed.args[0]);
  }
});
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
// Define response types
interface FileResult {
  success: boolean;
  data?: string;
  error?: string;
}

app.handle('file:read', schema, async ({ path }): Promise<FileResult> => {
  try {
    const data = fs.readFileSync(path, 'utf-8');
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
```

## Next Steps

- [Windows Guide](windows.md) - Window management
- [API Reference: app](../api/app.md) - Full app API
