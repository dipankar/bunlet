# Quick Start

Build your first Bunlet app in 5 minutes.

## Create a New App

```bash
bun create bunlet my-app
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

// Register an IPC handler
app.handle(
  'greet',
  z.object({ name: z.string() }),
  async ({ name }) => {
    return `Hello, ${name}!`;
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

// Load the UI
mainWindow.loadFile('index.html');

// Start the event loop
app.run();
```

### User Interface (`index.html`)

```html
<!DOCTYPE html>
<html>
<head>
  <title>My Bunlet App</title>
  <style>
    body {
      font-family: system-ui, sans-serif;
      padding: 2rem;
    }
  </style>
</head>
<body>
  <h1>Welcome to Bunlet!</h1>
  <input type="text" id="name" placeholder="Your name">
  <button onclick="greet()">Greet</button>
  <p id="result"></p>

  <script>
    async function greet() {
      const name = document.getElementById('name').value;
      const result = await window.__bunlet.invoke({
        jsonrpc: '2.0',
        id: Date.now().toString(),
        method: 'greet',
        params: { name }
      });
      document.getElementById('result').textContent = result;
    }
  </script>
</body>
</html>
```

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
const result = await invoke('method-name', { /* params */ });
```

### Event Loop

The `app.run()` call blocks and runs the native event loop. All window creation and handler registration must happen before this call.

## Next Steps

- [Project Structure](project-structure.md) - Learn about the recommended app structure
- [Windows Guide](../guides/windows.md) - Deep dive into window management
- [IPC Guide](../guides/ipc.md) - Advanced IPC patterns
