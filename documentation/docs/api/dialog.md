# dialog

Display native file dialogs and message boxes.

```typescript
import { dialog } from '@bunlet/core';
```

## Methods

### `showOpenDialog(window, options)`

Show a file open dialog.

```typescript
const result = await dialog.showOpenDialog(null, {
  title: 'Select File',
  filters: [
    { name: 'Text', extensions: ['txt'] },
  ],
  properties: ['openFile'],
});
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `window` | `BrowserWindow \| null` | Parent window |
| `options` | `OpenDialogOptions` | Dialog options |

**Returns:** `Promise<OpenDialogReturnValue>`

#### OpenDialogOptions

```typescript
interface OpenDialogOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: FileFilter[];
  properties?: Array<
    | 'openFile'
    | 'openDirectory'
    | 'multiSelections'
    | 'showHiddenFiles'
    | 'createDirectory'
    | 'promptToCreate'
  >;
}
```

#### OpenDialogReturnValue

```typescript
interface OpenDialogReturnValue {
  canceled: boolean;
  filePaths: string[];
}
```

---

### `showSaveDialog(window, options)`

Show a file save dialog.

```typescript
const result = await dialog.showSaveDialog(null, {
  title: 'Save File',
  defaultPath: 'untitled.txt',
  filters: [
    { name: 'Text', extensions: ['txt'] },
  ],
});
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `window` | `BrowserWindow \| null` | Parent window |
| `options` | `SaveDialogOptions` | Dialog options |

**Returns:** `Promise<SaveDialogReturnValue>`

#### SaveDialogOptions

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

#### SaveDialogReturnValue

```typescript
interface SaveDialogReturnValue {
  canceled: boolean;
  filePath?: string;
}
```

---

### `showMessageBox(window, options)`

Show a message box.

```typescript
const result = await dialog.showMessageBox(null, {
  type: 'question',
  title: 'Confirm',
  message: 'Save changes?',
  buttons: ['Save', 'Don\'t Save', 'Cancel'],
});
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `window` | `BrowserWindow \| null` | Parent window |
| `options` | `MessageBoxOptions` | Dialog options |

**Returns:** `Promise<MessageBoxReturnValue>`

#### MessageBoxOptions

```typescript
interface MessageBoxOptions {
  type?: 'none' | 'info' | 'error' | 'question' | 'warning';
  buttons?: string[];
  defaultId?: number;
  title?: string;
  message: string;
  detail?: string;
  checkboxLabel?: string;
  checkboxChecked?: boolean;
  cancelId?: number;
  noLink?: boolean;
}
```

#### MessageBoxReturnValue

```typescript
interface MessageBoxReturnValue {
  response: number;
  checkboxChecked?: boolean;
}
```

---

### `showErrorBox(title, content)`

Show a synchronous error dialog.

```typescript
dialog.showErrorBox('Error', 'Something went wrong');
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `title` | `string` | Dialog title |
| `content` | `string` | Error message |

## Types

### FileFilter

```typescript
interface FileFilter {
  name: string;        // Display name
  extensions: string[]; // File extensions (without dot)
}
```

## Examples

### Open Multiple Files

```typescript
const result = await dialog.showOpenDialog(null, {
  properties: ['openFile', 'multiSelections'],
});

for (const path of result.filePaths) {
  console.log(path);
}
```

### Save with Filters

```typescript
const result = await dialog.showSaveDialog(null, {
  defaultPath: 'document.md',
  filters: [
    { name: 'Markdown', extensions: ['md'] },
    { name: 'All Files', extensions: ['*'] },
  ],
});
```

### Confirmation Dialog

```typescript
const { response } = await dialog.showMessageBox(null, {
  type: 'question',
  message: 'Delete this item?',
  buttons: ['Delete', 'Cancel'],
  defaultId: 1,
  cancelId: 1,
});

if (response === 0) {
  deleteItem();
}
```
