# Dialogs

Display native file dialogs and message boxes.

## File Open Dialog

```typescript
import { dialog, BrowserWindow } from '@bunlet/core';

const result = await dialog.showOpenDialog(null, {
  title: 'Select a file',
  defaultPath: '/home/user/documents',
  filters: [
    { name: 'Text Files', extensions: ['txt', 'md'] },
    { name: 'All Files', extensions: ['*'] },
  ],
  properties: ['openFile'],
});

if (!result.canceled) {
  console.log('Selected:', result.filePaths);
}
```

### Open Dialog Options

```typescript
interface OpenDialogOptions {
  title?: string;              // Dialog title
  defaultPath?: string;        // Initial directory
  buttonLabel?: string;        // Custom button text
  filters?: FileFilter[];      // File type filters
  properties?: Array<
    | 'openFile'              // Allow file selection
    | 'openDirectory'         // Allow directory selection
    | 'multiSelections'       // Allow multiple selections
    | 'showHiddenFiles'       // Show hidden files
    | 'createDirectory'       // Allow creating directories (macOS)
    | 'promptToCreate'        // Prompt to create non-existent path (Windows)
  >;
}
```

### File Filters

```typescript
const filters = [
  { name: 'Images', extensions: ['jpg', 'png', 'gif'] },
  { name: 'Documents', extensions: ['pdf', 'doc', 'docx'] },
  { name: 'All Files', extensions: ['*'] },
];
```

## File Save Dialog

```typescript
const result = await dialog.showSaveDialog(null, {
  title: 'Save file',
  defaultPath: '/home/user/documents/untitled.txt',
  filters: [
    { name: 'Text Files', extensions: ['txt'] },
  ],
});

if (!result.canceled && result.filePath) {
  // Save to result.filePath
}
```

### Save Dialog Options

```typescript
interface SaveDialogOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: FileFilter[];
  properties?: Array<
    | 'showHiddenFiles'
    | 'createDirectory'
  >;
}
```

## Message Box

```typescript
const result = await dialog.showMessageBox(null, {
  type: 'question',
  title: 'Confirm',
  message: 'Do you want to save changes?',
  detail: 'Your changes will be lost if you don\'t save them.',
  buttons: ['Save', 'Don\'t Save', 'Cancel'],
  defaultId: 0,
  cancelId: 2,
});

switch (result.response) {
  case 0: // Save
    saveFile();
    break;
  case 1: // Don't Save
    closeWithoutSaving();
    break;
  case 2: // Cancel
    // Do nothing
    break;
}
```

### Message Box Types

```typescript
type: 'none' | 'info' | 'error' | 'question' | 'warning'
```

Each type displays a different icon.

### Message Box Options

```typescript
interface MessageBoxOptions {
  type?: 'none' | 'info' | 'error' | 'question' | 'warning';
  buttons?: string[];
  defaultId?: number;       // Default button index
  title?: string;
  message: string;          // Primary message (required)
  detail?: string;          // Secondary text
  checkboxLabel?: string;   // Show a checkbox
  checkboxChecked?: boolean;
  cancelId?: number;        // Button index for Escape key
  noLink?: boolean;         // Disable sheet style on macOS
}
```

### With Checkbox

```typescript
const result = await dialog.showMessageBox(null, {
  type: 'warning',
  message: 'Delete this item?',
  detail: 'This action cannot be undone.',
  buttons: ['Delete', 'Cancel'],
  checkboxLabel: 'Don\'t ask me again',
  checkboxChecked: false,
});

if (result.checkboxChecked) {
  // Remember this choice
}
```

## Error Box

A simple synchronous error dialog:

```typescript
dialog.showErrorBox('Error', 'Something went wrong!');
```

## With Window Parent

Associate dialogs with a window:

```typescript
const mainWindow = new BrowserWindow();

// Dialog will be modal to this window
const result = await dialog.showOpenDialog(mainWindow, {
  title: 'Open File',
});
```

## Examples

### Open Multiple Files

```typescript
const result = await dialog.showOpenDialog(null, {
  title: 'Select files',
  properties: ['openFile', 'multiSelections'],
  filters: [
    { name: 'Images', extensions: ['jpg', 'png', 'gif'] },
  ],
});

for (const filePath of result.filePaths) {
  processFile(filePath);
}
```

### Select Directory

```typescript
const result = await dialog.showOpenDialog(null, {
  title: 'Select folder',
  properties: ['openDirectory'],
});

if (!result.canceled) {
  const folder = result.filePaths[0];
}
```

### Save with Default Name

```typescript
const result = await dialog.showSaveDialog(null, {
  title: 'Export',
  defaultPath: `export-${Date.now()}.json`,
  filters: [
    { name: 'JSON', extensions: ['json'] },
  ],
});
```

### Confirmation Dialog

```typescript
async function confirmAction(message: string): Promise<boolean> {
  const result = await dialog.showMessageBox(null, {
    type: 'question',
    message,
    buttons: ['Yes', 'No'],
    defaultId: 0,
    cancelId: 1,
  });
  return result.response === 0;
}

// Usage
if (await confirmAction('Delete this file?')) {
  deleteFile();
}
```

### Info/Warning/Error Dialogs

```typescript
// Info
await dialog.showMessageBox(null, {
  type: 'info',
  title: 'Information',
  message: 'Operation completed successfully.',
});

// Warning
await dialog.showMessageBox(null, {
  type: 'warning',
  title: 'Warning',
  message: 'This will overwrite existing data.',
  buttons: ['Continue', 'Cancel'],
});

// Error
await dialog.showMessageBox(null, {
  type: 'error',
  title: 'Error',
  message: 'Failed to save file.',
  detail: 'Permission denied.',
});
```

## IPC Integration

Call dialogs from the renderer:

```typescript
// Main process
app.handle('dialog:open', z.object({
  filters: z.array(z.object({
    name: z.string(),
    extensions: z.array(z.string()),
  })).optional(),
}), async ({ filters }, { window }) => {
  const result = await dialog.showOpenDialog(window, {
    filters,
    properties: ['openFile'],
  });
  return result;
});

app.handle('dialog:confirm', z.object({
  message: z.string(),
}), async ({ message }) => {
  const result = await dialog.showMessageBox(null, {
    type: 'question',
    message,
    buttons: ['Yes', 'No'],
  });
  return result.response === 0;
});
```

```javascript
// Renderer
const result = await invoke('dialog:open', {
  filters: [{ name: 'Images', extensions: ['jpg', 'png'] }],
});

const confirmed = await invoke('dialog:confirm', {
  message: 'Are you sure?',
});
```

## Next Steps

- [Notifications](notifications.md) - Desktop notifications
- [API Reference: dialog](../api/dialog.md)
