# Shell

Interact with the system shell and file manager.

## Opening URLs

Open a URL in the default browser:

```typescript
import { shell } from 'bunlet';

await shell.openExternal('https://bunlet.dev');
```

### With Options

```typescript
await shell.openExternal('https://bunlet.dev', {
  activate: true,           // Bring browser to foreground (macOS)
  workingDirectory: '/tmp', // Working directory
});
```

## Opening Files

Open a file with its default application:

```typescript
// Open a document
await shell.openPath('/path/to/document.pdf');

// Open an image
await shell.openPath('/path/to/image.png');

// Open a folder
await shell.openPath('/path/to/folder');
```

### Error Handling

```typescript
const error = await shell.openPath('/path/to/file.pdf');

if (error) {
  console.error('Failed to open:', error);
} else {
  console.log('File opened successfully');
}
```

## Show in File Manager

Reveal a file in the system file manager:

```typescript
// Show file selected in Finder/Explorer/Files
shell.showItemInFolder('/path/to/file.txt');
```

This opens the containing folder with the file selected.

## Move to Trash

Move a file or folder to the trash/recycle bin:

```typescript
await shell.trashItem('/path/to/file.txt');
```

This is safer than deleting files directly, as users can recover them.

## System Beep

Play the system beep sound:

```typescript
shell.beep();
```

## Examples

### Open Links from Renderer

```typescript
// Main process
app.handle('open-link', z.object({
  url: z.string().url(),
}), async ({ url }) => {
  await shell.openExternal(url);
  return true;
});
```

```javascript
// Renderer - intercept link clicks
document.addEventListener('click', async (e) => {
  const link = e.target.closest('a[href^="http"]');
  if (link) {
    e.preventDefault();
    await invoke('open-link', { url: link.href });
  }
});
```

### Export and Open

```typescript
import * as fs from 'fs';
import * as path from 'path';

app.handle('export-and-open', z.object({
  content: z.string(),
  filename: z.string(),
}), async ({ content, filename }) => {
  const exportPath = path.join(app.getPath('downloads'), filename);

  fs.writeFileSync(exportPath, content);

  // Open the exported file
  await shell.openPath(exportPath);

  return exportPath;
});
```

### Reveal Downloads

```typescript
app.handle('show-downloads', z.object({}), async () => {
  const downloadsPath = app.getPath('downloads');
  shell.showItemInFolder(downloadsPath);
  return true;
});
```

### Delete to Trash

```typescript
app.handle('delete-file', z.object({
  path: z.string(),
}), async ({ path }) => {
  try {
    await shell.trashItem(path);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
```

### Open Project Folder

```typescript
app.handle('open-project-folder', z.object({
  projectPath: z.string(),
}), async ({ projectPath }) => {
  const error = await shell.openPath(projectPath);
  return !error;
});
```

### Open in Code Editor

```typescript
app.handle('open-in-editor', z.object({
  filePath: z.string(),
}), async ({ filePath }) => {
  // Try VS Code first
  const vscodeUrl = `vscode://file/${filePath}`;
  await shell.openExternal(vscodeUrl);
  return true;
});
```

## API Reference

| Method | Description |
|--------|-------------|
| `openExternal(url, options?)` | Open URL in default browser |
| `openPath(path)` | Open file/folder with default app |
| `showItemInFolder(path)` | Reveal in file manager |
| `trashItem(path)` | Move to trash |
| `beep()` | Play system beep |

## Platform Notes

### macOS
- `showItemInFolder` opens Finder with the file selected
- `openExternal` can open custom URL schemes (e.g., `mailto:`, `tel:`)

### Windows
- `showItemInFolder` opens Explorer with the file selected
- Supports Windows-specific URL schemes

### Linux
- Uses `xdg-open` for opening files and URLs
- File manager behavior varies by desktop environment

## Next Steps

- [Global Shortcuts](shortcuts.md) - Keyboard shortcuts
- [API Reference: shell](../api/shell.md)
