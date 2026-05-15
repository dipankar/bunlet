# globalShortcut

Register and manage global keyboard shortcuts.

```typescript
import { globalShortcut } from '@bunlet/core';
```

## Methods

### `register(accelerator, callback)`

Register a global shortcut.

```typescript
const success = globalShortcut.register('CmdOrCtrl+Shift+X', () => {
  console.log('Shortcut pressed!');
});

if (!success) {
  console.log('Registration failed');
}
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `accelerator` | `string` | Keyboard shortcut |
| `callback` | `() => void` | Handler function |

**Returns:** `boolean` - Whether registration succeeded

---

### `registerAll(accelerators, callback)`

Register multiple shortcuts with the same handler.

```typescript
globalShortcut.registerAll(['CmdOrCtrl+1', 'CmdOrCtrl+2'], () => {
  console.log('One of the shortcuts pressed');
});
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `accelerators` | `string[]` | Array of shortcuts |
| `callback` | `() => void` | Handler function |

---

### `isRegistered(accelerator)`

Check if a shortcut is registered.

```typescript
if (globalShortcut.isRegistered('CmdOrCtrl+X')) {
  console.log('Shortcut is registered');
}
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `accelerator` | `string` | Keyboard shortcut |

**Returns:** `boolean`

---

### `unregister(accelerator)`

Unregister a global shortcut.

```typescript
globalShortcut.unregister('CmdOrCtrl+X');
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `accelerator` | `string` | Keyboard shortcut |

---

### `unregisterAll()`

Unregister all shortcuts.

```typescript
globalShortcut.unregisterAll();
```

## Accelerator Format

Shortcuts use modifier keys combined with regular keys:

### Modifiers

| Modifier | Description |
|----------|-------------|
| `Cmd` | Command key (macOS) |
| `Ctrl` | Control key |
| `CmdOrCtrl` | Cmd on macOS, Ctrl on Windows/Linux |
| `Alt` | Alt/Option key |
| `Shift` | Shift key |
| `Super` | Windows/Super key |

### Keys

- Letters: `A` through `Z`
- Numbers: `0` through `9`
- Function keys: `F1` through `F24`
- Special: `Space`, `Tab`, `Backspace`, `Delete`, `Enter`, `Escape`
- Navigation: `Up`, `Down`, `Left`, `Right`, `Home`, `End`, `PageUp`, `PageDown`
- Punctuation: `Plus`, `Minus`, `=`, `[`, `]`, `;`, `'`, `,`, `.`, `/`, `\`, `` ` ``

### Examples

```typescript
'CmdOrCtrl+S'         // Save
'CmdOrCtrl+Shift+S'   // Save As
'CmdOrCtrl+Alt+I'     // DevTools
'F11'                 // Fullscreen
'CmdOrCtrl+Shift+F5'  // Force Reload
```

## Example

```typescript
import { app, globalShortcut, BrowserWindow } from '@bunlet/core';

app.whenReady().then(() => {
  const win = new BrowserWindow();
  win.loadFile('index.html');

  // Toggle window visibility
  globalShortcut.register('CmdOrCtrl+Shift+Space', () => {
    if (win.isVisible()) {
      win.hide();
    } else {
      win.show();
      win.focus();
    }
  });

  // Quick screenshot
  globalShortcut.register('CmdOrCtrl+Shift+4', async () => {
    // Capture screenshot logic
  });
});

app.on('will-quit', () => {
  // Unregister all shortcuts when quitting
  globalShortcut.unregisterAll();
});
```

## Notes

- Global shortcuts work even when the app is not focused
- Some shortcuts may conflict with system shortcuts
- Always unregister shortcuts when the app quits
- Registration may fail if another app has registered the same shortcut
