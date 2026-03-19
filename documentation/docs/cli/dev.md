# bunlet dev

Start the development server with hot reload.

## Usage

```bash
bunlet dev [options]
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `-p, --port <number>` | Dev server port | `5173` |
| `--no-hot` | Disable hot reload | - |
| `--inspect` | Enable Node.js inspector | - |

## Features

### Hot Reload

The development server automatically reloads when files change:

- **Renderer process**: Instant hot module replacement (HMR)
- **Main process**: Automatic restart on save

### DevTools

DevTools open automatically in development mode. Toggle with:
- `Cmd+Option+I` (macOS)
- `Ctrl+Shift+I` (Windows/Linux)

### Error Overlay

Compilation errors display directly in the app window with:
- Error message
- File location
- Stack trace
- Quick fix suggestions

## Examples

### Basic Development

```bash
bunlet dev
```

Opens app at `http://localhost:5173`

### Custom Port

```bash
bunlet dev --port 3000
```

### Debug Main Process

```bash
bunlet dev --inspect
```

Connect debugger at `chrome://inspect`

## Environment Variables

Development mode sets:

```typescript
process.env.NODE_ENV = 'development';
```

Use in your code:

```typescript
if (process.env.NODE_ENV === 'development') {
  win.webContents.openDevTools();
}
```

## Configuration

Configure dev server in `bunlet.config.ts`:

```typescript
export default {
  dev: {
    port: 5173,
    hot: true,
  },
};
```

## Troubleshooting

### Port Already in Use

```bash
bunlet dev --port 5174
```

### Hot Reload Not Working

1. Check file watcher limits on Linux:
   ```bash
   echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
   sudo sysctl -p
   ```

2. Ensure files are being saved properly

### Main Process Not Restarting

Check for syntax errors in main process files. Errors are logged to the terminal.
