# Project Structure

Learn how to organize your Bunlet application.

## Basic Structure

A minimal Bunlet app requires just two files:

```
my-app/
├── main.ts       # Main process
└── index.html    # UI
```

## Recommended Structure

For larger applications, we recommend this structure:

```
my-app/
├── src/
│   ├── main/                 # Main process code
│   │   ├── index.ts          # Entry point
│   │   ├── handlers/         # IPC handlers
│   │   │   ├── files.ts
│   │   │   └── settings.ts
│   │   ├── menu.ts           # Application menu
│   │   └── storage.ts        # Local storage/database
│   │
│   └── renderer/             # UI code
│       ├── index.html
│       ├── styles/
│       │   └── main.css
│       └── scripts/
│           └── app.js
│
├── assets/                   # Static assets
│   ├── icons/
│   │   ├── icon.png
│   │   ├── icon.icns         # macOS
│   │   └── icon.ico          # Windows
│   └── images/
│
├── package.json
├── tsconfig.json
└── bunlet.config.ts          # Build configuration (optional)
```

## Main Process Organization

### Entry Point

```typescript title="src/main/index.ts"
import { app, BrowserWindow } from '@bunlet/core';
import { registerHandlers } from './handlers';
import { createMenu } from './menu';

// Register all IPC handlers
registerHandlers();

// Wait for app ready
await app.whenReady();

// Set up application menu
createMenu();

// Create main window
const mainWindow = new BrowserWindow({
  width: 1200,
  height: 800,
  title: 'My App',
});

mainWindow.loadFile('src/renderer/index.html');

// Start event loop
app.run();
```

### Organizing Handlers

Group related handlers into modules:

```typescript title="src/main/handlers/index.ts"
import { registerFileHandlers } from './files';
import { registerSettingsHandlers } from './settings';

export function registerHandlers() {
  registerFileHandlers();
  registerSettingsHandlers();
}
```

```typescript title="src/main/handlers/files.ts"
import { app, z } from '@bunlet/core';
import * as fs from 'fs';

export function registerFileHandlers() {
  app.handle(
    'file:read',
    z.object({ path: z.string() }),
    async ({ path }) => {
      return fs.readFileSync(path, 'utf-8');
    }
  );

  app.handle(
    'file:write',
    z.object({ path: z.string(), content: z.string() }),
    async ({ path, content }) => {
      fs.writeFileSync(path, content);
      return true;
    }
  );
}
```

## Renderer Organization

### HTML Entry Point

```html title="src/renderer/index.html"
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My App</title>
  <link rel="stylesheet" href="styles/main.css">
</head>
<body>
  <div id="app"></div>
  <script src="scripts/app.js"></script>
</body>
</html>
```

### Using a Framework

You can use any frontend framework. For example, with React:

```
src/renderer/
├── index.html
├── main.tsx          # React entry point
├── App.tsx
├── components/
│   ├── Header.tsx
│   └── Sidebar.tsx
└── hooks/
    └── useIPC.ts
```

## Configuration Files

### package.json

```json title="package.json"
{
  "name": "my-app",
  "version": "1.0.0",
  "main": "src/main/index.ts",
  "scripts": {
    "dev": "bunlet dev",
    "build": "bunlet build",
    "package": "bunlet package"
  },
  "dependencies": {
    "@bunlet/core": "^0.1.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
```

### tsconfig.json

```json title="tsconfig.json"
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["bun-types"]
  },
  "include": ["src/**/*"]
}
```

## Assets and Resources

### Application Icons

Provide icons for all platforms:

- `icon.png` - 512x512 or 1024x1024 PNG (used for Linux and as source)
- `icon.icns` - macOS icon bundle
- `icon.ico` - Windows icon

### Loading Assets

In the main process:

```typescript
import { app } from '@bunlet/core';
import * as path from 'path';

// Get path to assets
const iconPath = path.join(app.getAppPath(), 'assets/icons/icon.png');
```

In the renderer, use relative paths from your HTML file.

## Environment-Specific Code

Handle development vs production:

```typescript
const isDev = process.env.NODE_ENV !== 'production';

if (isDev) {
  // Development: load from dev server
  mainWindow.loadURL('http://localhost:5173');
  mainWindow.webContents.openDevTools();
} else {
  // Production: load bundled files
  mainWindow.loadFile('dist/index.html');
}
```

## Next Steps

- [Windows Guide](../guides/windows.md) - Creating and managing windows
- [IPC Guide](../guides/ipc.md) - Communication between processes
- [CLI Reference](../cli/overview.md) - Build and development commands
