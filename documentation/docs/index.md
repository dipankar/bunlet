# Bunlet

Build cross-platform desktop apps with [Bun](https://bun.sh) and native WebView.

Bunlet combines Bun's speed with native WebView rendering to create lightweight, fast desktop applications using familiar Electron-like APIs.

## Why Bunlet?

| Feature | Bunlet | Electron | Tauri |
|---------|--------|----------|-------|
| Runtime | Bun | Node.js | None (Rust) |
| WebView | System WebView | Chromium (bundled) | System WebView |
| Installer Size | 20-40MB | 80-150MB | 2-10MB |
| Language | TypeScript | JavaScript | Rust + JS |
| Memory Usage | Low | High | Very Low |
| Learning Curve | Easy (Electron-like API) | Easy | Moderate |

## Quick Start

```bash
# Install Bun if you haven't
curl -fsSL https://bun.sh/install | bash

# Create a new app
bunlet create my-app
cd my-app
bunlet dev
```

Or [set up from source](https://github.com/dipankar/bunlet):

```bash
git clone https://github.com/dipankar/bunlet
cd bunlet
bun run setup
bun run doctor
```

## Example

```typescript
// main.ts
import { app, BrowserWindow, z } from 'bunlet';
import path from 'path';

app.handle('greet', z.object({ name: z.string() }), async (params) => {
  return `Hello, ${params.name}!`;
});

app.on('window-all-closed', () => app.quit());

await app.whenReady();

const win = new BrowserWindow({ width: 800, height: 600 });
win.loadFile(path.join(import.meta.dir, 'index.html'));

app.run();
```

```html
<!-- index.html -->
<script>
  async function greet() {
    const name = document.getElementById('name').value;
    const result = await window.__bunlet.invoke({
      method: 'greet',
      params: { name }
    });
    document.getElementById('output').textContent = result;
  }
</script>
```

## Key Features

- **Familiar API** - Electron-compatible design you already know
- **TypeScript-First** - Full type safety with Zod validation for IPC
- **Native Performance** - Rust backend with NAPI bindings
- **Cross-Platform** - Windows, macOS, and Linux
- **Small Footprint** - Uses system WebView, no bundled Chromium

## Next Steps

- [Installation](getting-started/installation.md) - Set up your environment
- [Quick Start](getting-started/quick-start.md) - Build your first app
- [Project Structure](getting-started/project-structure.md) - Organize your code
- [IPC Communication](guides/ipc.md) - Talk between main and renderer
- [Preload Scripts](guides/preload.md) - Secure API exposure