# bunlet dev

Start the development server with hot reload and DevTools.

## Usage

```bash
bunlet dev [options]
```

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `--port, -p` | `5173` | Dev server port |
| `--host` | `localhost` | Dev server host |
| `--open` | `true` | Open window automatically |
| `--devtools` | `true` | Open DevTools on start |
| `--no-hmr` | `false` | Disable Hot Module Replacement |
| `--inspect` | - | Enable Node.js inspector |
| `--inspect-brk` | - | Inspector with breakpoint on start |

## Features

### Hot Module Replacement (HMR)

The dev server provides instant updates without full page reload:

- **JavaScript/TypeScript**: Module-level hot replacement
- **CSS**: Instant style updates
- **React**: Fast Refresh support
- **Vue**: Vue HMR support
- **Svelte**: Svelte HMR support

### Main Process Watching

Changes to main process files trigger automatic restart:

```
src/main.ts          → Restart main process
src/preload.ts       → Restart + reload renderer
bunlet.config.ts     → Full restart
```

### Error Overlay

Build errors display in an overlay:

- Syntax errors with line numbers
- TypeScript type errors
- Stack traces with source maps
- Click to open in editor

## Examples

### Basic Development

```bash
bunlet dev
```

Opens your app with:
- Dev server on `http://localhost:5173`
- HMR enabled
- DevTools available

### Custom Port

```bash
bunlet dev --port 3000
```

### Without Auto-Open

```bash
bunlet dev --no-open
```

### Without DevTools

```bash
bunlet dev --no-devtools
```

### Debug Mode

```bash
# Enable Node.js inspector
bunlet dev --inspect

# Break on first line
bunlet dev --inspect-brk
```

Then attach VS Code debugger or Chrome DevTools.

## Development Workflow

### 1. Start Dev Server

```bash
bunlet dev
```

### 2. Edit Code

Changes are applied instantly:

```typescript
// src/renderer/App.tsx
export function App() {
  return <h1>Hello World</h1>; // Edit this
}
```

### 3. View Updates

The window updates without reload. State is preserved (React/Vue).

### 4. Debug

- Press `F12` or `Cmd+Option+I` for DevTools
- Use console, network, and element inspectors
- Source maps show original TypeScript

## HMR API

For custom HMR handling:

```typescript
// src/renderer/index.ts
if (import.meta.hot) {
  import.meta.hot.accept('./module', (newModule) => {
    // Handle module update
    console.log('Module updated:', newModule);
  });

  import.meta.hot.dispose(() => {
    // Cleanup before update
  });
}
```

## Console Output

The terminal shows:

```
  Bunlet Dev Server

  ➜  App:      http://localhost:5173
  ➜  DevTools: Cmd+Option+I or F12

  [HMR] Connected
  [Main] Window created
  [Renderer] index.ts updated
```

## Environment Variables

In development mode:

```typescript
process.env.NODE_ENV === 'development'
```

Access in renderer via preload:

```typescript
// preload.ts
contextBridge.exposeInMainWorld('env', {
  isDev: process.env.NODE_ENV === 'development',
});
```

## Configuration

Dev-specific settings in `bunlet.config.ts`:

```typescript
export default defineConfig({
  // Dev server options
  dev: {
    port: 5173,
    host: 'localhost',
    hmr: true,
    open: true,
    devtools: true,
  },
});
```

## Troubleshooting

### Port Already in Use

```bash
# Use different port
bunlet dev --port 3001

# Or kill existing process
lsof -i :5173  # Find process
kill -9 <PID>  # Kill it
```

### HMR Not Working

1. Check WebSocket connection in DevTools Network tab
2. Ensure `import.meta.hot` checks are present
3. Try disabling browser cache

### Main Process Not Restarting

1. Check file is being watched
2. Verify file is saved
3. Check terminal for errors

### DevTools Won't Open

```bash
# Force DevTools
bunlet dev --devtools

# Or open manually in app menu
# View → Toggle Developer Tools
```

## Related

- [Quick Start](../getting-started/quick-start.md)
- [Hot Reload Guide](../guides/hot-reload.md)
- [Debugging Guide](../guides/debugging.md)
