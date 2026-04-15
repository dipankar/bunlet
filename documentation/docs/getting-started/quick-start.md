# Quick Start

Build your first Bunlet app in 5 minutes.

## Prerequisites

- [Bun](https://bun.sh) 1.0+
- [Rust](https://rustup.rs) stable 1.70+
- Platform requirements (see [Installation](installation.md))

## Create a New App

```bash
bunlet create my-app
cd my-app
```

## Project Structure

Your new project looks like this:

```
my-app/
├── main.ts          # Main process entry point
├── index.html       # UI content
├── package.json
└── tsconfig.json
```

## Understanding the Code

### Main Process (`main.ts`)

```typescript
import { app, BrowserWindow, z } from 'bunlet';
import path from 'path';

// Register an IPC handler
app.handle(
  'greet',
  z.object({ name: z.string() }),
  async (params) => {
    return `Hello, ${params.name}!`;
  }
);

// Handle app lifecycle
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Wait for app to be ready
await app.whenReady();

// Create the main window
const mainWindow = new BrowserWindow({
  width: 800,
  height: 600,
  title: 'My Bunlet App',
});

// Load the UI (always use import.meta.dir for reliable path resolution)
mainWindow.loadFile(path.join(import.meta.dir, 'index.html'));

// Start the event loop
app.run();
```

!!! note "Handler signature"

    The `app.handle()` callback receives `(params, context)` where `params` is the
    Zod-validated input and `context` contains `{ window, windowId }`.
    If your handler doesn't need the context, just use `(params)`.

### User Interface (`index.html`)

```html
<!DOCTYPE html>
<html>
<head>
  <title>My Bunlet App</title>
</head>
<body>
  <h1>Welcome to Bunlet!</h1>
  <input type="text" id="name" placeholder="Your name">
  <button onclick="greet()">Greet</button>
  <p id="result"></p>

  <script>
    async function greet() {
      const name = document.getElementById('name').value;
      // Use the injected IPC bridge
      const result = await window.__bunlet.invoke({
        method: 'greet',
        params: { name }
      });
      document.getElementById('result').textContent = result;
    }
  </script>
</body>
</html>
```

!!! tip "Using a preload script"

    For production apps, use a preload script with `contextBridge` instead of
    accessing `window.__bunlet` directly. See [Preload Scripts](../guides/preload.md).

## Run Your App

```bash
bun run main.ts
```

A window will open with your app. Enter a name and click "Greet" to see the IPC in action.

## Development Mode

For a better development experience with hot reloading:

```bash
bunlet dev
```

This starts the development server and watches for file changes.

## Build for Production

When you're ready to distribute your app:

```bash
bunlet build
```

This creates optimized builds for your target platform.

## Key Concepts

### Main Process vs Renderer

- **Main Process**: Runs in Bun, has access to native APIs, manages windows
- **Renderer**: Runs in the WebView, displays the UI, communicates via IPC

### IPC (Inter-Process Communication)

Bunlet uses a JSON-RPC 2.0 based IPC system with Zod validation:

```typescript
// Main process: define a handler
app.handle(
  'method-name',
  z.object({ /* schema */ }),
  async (params) => {
    // Return result
  }
);

// Renderer: call the handler
const result = await window.__bunlet.invoke({
  method: 'method-name',
  params: { /* ... */ }
});
```

### Main-to-Renderer Push

Send messages from the main process to the renderer:

```typescript
// Main process
win.webContents.send('my-event', { data: 42 });

// Renderer
window.__bunlet.on('my-event', (event, data) => {
  console.log('Got data:', data);
});
```

### Event Loop

The `app.run()` call blocks and runs the native event loop. All window creation and handler registration must happen before this call.

## Next Steps

- [Project Structure](project-structure.md) - Learn about the recommended app structure
- [Preload Scripts](../guides/preload.md) - Secure API exposure with contextBridge
- [Windows Guide](../guides/windows.md) - Deep dive into window management
- [IPC Guide](../guides/ipc.md) - Advanced IPC patterns