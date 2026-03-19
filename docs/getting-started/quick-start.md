# Quick Start

Create your first Bunlet app in 5 minutes!

## Create a New Project

```bash
bunlet create my-app
```

The current starter template is `default` (additional templates are planned).

Specify it directly:
```bash
bunlet create my-app --template default
```

## Project Structure

```
my-app/
├── bunlet.config.ts    # App configuration
├── package.json
├── tsconfig.json
├── src/
│   ├── main.ts         # Main process (Node-like)
│   ├── preload.ts      # Preload script (bridge)
│   └── renderer/       # Frontend code
│       ├── index.html
│       ├── index.ts
│       └── styles.css
└── resources/
    └── icon.png        # App icon (1024x1024)
```

## Start Development

```bash
cd my-app
bunlet dev
```

Your app window opens automatically with:
- Hot Module Replacement (HMR)
- DevTools available (F12 or Cmd+Option+I)
- Live console output in terminal

## Understanding the Code

### Main Process (`src/main.ts`)

The main process runs in Bun and has full system access:

```typescript
import { app, BrowserWindow } from 'bunlet';

// Wait for app to be ready
app.whenReady().then(() => {
  // Create the main window
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'My App',
    webPreferences: {
      preload: './preload.ts',
    },
  });

  // Load the renderer
  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile('./renderer/index.html');
  }
});

// Handle window close behavior
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// macOS: Re-create window when dock icon clicked
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
```

### Preload Script (`src/preload.ts`)

The preload script bridges main and renderer securely:

```typescript
import { contextBridge, ipcRenderer } from 'bunlet/renderer';

// Expose safe APIs to the renderer
contextBridge.exposeInMainWorld('api', {
  // Invoke main process handlers
  readFile: (path: string) =>
    ipcRenderer.invoke('fs:read', { path }),

  writeFile: (path: string, content: string) =>
    ipcRenderer.invoke('fs:write', { path, content }),

  // Platform info
  platform: process.platform,

  // Event listeners
  onUpdate: (callback: (data: any) => void) => {
    ipcRenderer.on('update', callback);
    return () => ipcRenderer.off('update', callback);
  },
});

// TypeScript declarations
declare global {
  interface Window {
    api: {
      readFile(path: string): Promise<string>;
      writeFile(path: string, content: string): Promise<void>;
      platform: NodeJS.Platform;
      onUpdate(callback: (data: any) => void): () => void;
    };
  }
}
```

### Renderer (`src/renderer/index.ts`)

The renderer runs in the WebView (browser context):

```typescript
// Use the exposed API
const content = await window.api.readFile('/path/to/file');
console.log(content);

// Listen for events from main process
const unsubscribe = window.api.onUpdate((data) => {
  console.log('Received update:', data);
});

// Platform-specific code
if (window.api.platform === 'darwin') {
  document.body.classList.add('macos');
}
```

## Adding IPC Handlers

In your main process, register handlers for renderer calls:

```typescript
// src/main.ts
import { app, BrowserWindow } from 'bunlet';
import { z } from 'zod';

// Define handler with type validation
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
```

## Build for Production

```bash
# Build the app bundle
bunlet build

# Create installer
bunlet package
```

Output is in `release/` directory.

## Next Steps

- [Project Structure](project-structure.md) - Detailed file layout
- [Configuration](configuration.md) - Customize bunlet.config.ts
- [Window Management](../guides/window-management.md) - Create and control windows
- [IPC Communication](../guides/ipc-communication.md) - Main ↔ Renderer messaging
