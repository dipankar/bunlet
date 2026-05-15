# bunlet create

Create a new Bunlet application from a starter template.

## Usage

```bash
bunlet create <app-name> [options]
```

## Arguments

| Argument | Description |
|----------|-------------|
| `app-name` | Name of the project (creates directory) |

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `--template, -t` | `default` | Project template (`default` only) |
| `--typescript` | `true` | Use TypeScript |
| `--webview` | `system` | WebView engine (system, cef) |
| `--git` | `true` | Initialize git repository |
| `--install` | `true` | Install dependencies |

## Templates

### `default`

Vanilla TypeScript with no frontend framework.

```bash
bunlet create my-app --template default
```

```
my-app/
├── bunlet.config.ts
├── package.json
├── tsconfig.json
├── main.ts
└── renderer/
    └── index.html
```

Additional framework templates are planned but not implemented yet.

## Examples

### Basic Project

```bash
bunlet create my-app
cd my-app
bunlet dev
```

### Default Template with CEF Mode

```bash
bunlet create my-app --template default --webview cef
```

### Without Git

```bash
bunlet create my-app --no-git
```

### Skip Dependency Installation

```bash
bunlet create my-app --no-install
cd my-app
bun install  # Install manually later
```

Interactive mode is not implemented yet.

## Generated Files

### `bunlet.config.ts`

```typescript
import { defineConfig } from 'bunlet/config';

export default defineConfig({
  appId: 'com.example.my-app',
  productName: 'My App',
  version: '0.1.0',

  main: './src/main.ts',
  preload: './src/preload.ts',
  renderer: {
    entry: './src/renderer/index.html',
  },

  webview: {
    engine: 'system',
  },
});
```

### `src/main.ts`

```typescript
import { app, BrowserWindow } from '@bunlet/core';

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: './preload.ts',
    },
  });

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile('./renderer/index.html');
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
```

### `src/preload.ts`

```typescript
import { contextBridge, ipcRenderer } from 'bunlet/renderer';

contextBridge.exposeInMainWorld('bunlet', {
  invoke: ipcRenderer.invoke,
  on: ipcRenderer.on,
  platform: process.platform,
  versions: {
    bunlet: '__BUNLET_VERSION__',
    bun: Bun.version,
  },
});
```

## After Creation

```bash
cd my-app

# Start development
bunlet dev

# Build for production
bunlet build

# Create installer
bunlet package
```

## Related

- [Quick Start](../getting-started/quick-start.md)
- [Project Structure](../getting-started/project-structure.md)
- [Configuration](../getting-started/configuration.md)
