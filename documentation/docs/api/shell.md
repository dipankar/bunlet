# shell

Manage files and URLs using the system's default applications.

```typescript
import { shell } from '@bunlet/core';
```

## Methods

### `openExternal(url, options?)`

Open a URL in the default browser.

```typescript
await shell.openExternal('https://bunlet.dev');
await shell.openExternal('mailto:hello@example.com');
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `url` | `string` | URL to open |
| `options` | `OpenExternalOptions` | Open options |

**Returns:** `Promise<void>`

#### OpenExternalOptions

```typescript
interface OpenExternalOptions {
  activate?: boolean;     // Bring browser to foreground (macOS)
  workingDirectory?: string; // Working directory
}
```

---

### `openPath(path)`

Open a file or folder with the default application.

```typescript
await shell.openPath('/path/to/document.pdf');
await shell.openPath('/path/to/folder');
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `path` | `string` | Path to open |

**Returns:** `Promise<string>` - Error message if failed, empty string on success

---

### `showItemInFolder(fullPath)`

Show a file in the file manager with the file selected.

```typescript
shell.showItemInFolder('/path/to/file.txt');
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `fullPath` | `string` | Full path to item |

---

### `trashItem(path)`

Move an item to the trash/recycle bin.

```typescript
await shell.trashItem('/path/to/file.txt');
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `path` | `string` | Path to trash |

**Returns:** `Promise<void>`

---

### `beep()`

Play the system beep sound.

```typescript
shell.beep();
```

## Examples

### Open Links

```typescript
// Website
await shell.openExternal('https://github.com');

// Email
await shell.openExternal('mailto:support@example.com?subject=Help');

// File URL
await shell.openExternal('file:///path/to/file.html');
```

### File Operations

```typescript
// Open a document
const error = await shell.openPath('/path/to/document.docx');
if (error) {
  console.error('Failed to open:', error);
}

// Reveal in file manager
shell.showItemInFolder(downloadedFilePath);

// Delete to trash
try {
  await shell.trashItem('/path/to/old-file.txt');
  console.log('Moved to trash');
} catch (err) {
  console.error('Failed to trash:', err);
}
```

### Download Complete Handler

```typescript
notification.on('click', () => {
  shell.showItemInFolder(downloadPath);
});
```
