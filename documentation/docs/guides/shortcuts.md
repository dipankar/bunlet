# Global Shortcuts

Register system-wide keyboard shortcuts.

## Registering Shortcuts

```typescript
import { globalShortcut } from 'bunlet';

const registered = globalShortcut.register('CmdOrCtrl+Shift+Space', () => {
  console.log('Shortcut triggered!');
  mainWindow.show();
});

if (registered) {
  console.log('Shortcut registered successfully');
} else {
  console.log('Shortcut registration failed');
}
```

## Accelerator Syntax

### Modifiers

| Modifier | Description |
|----------|-------------|
| `Command` | macOS Command key |
| `Cmd` | Alias for Command |
| `Control` | Control key |
| `Ctrl` | Alias for Control |
| `CmdOrCtrl` | Command on macOS, Control elsewhere |
| `Alt` | Alt/Option key |
| `Option` | Alias for Alt (macOS) |
| `Shift` | Shift key |
| `Super` | Windows/Super key |

### Keys

```
A-Z, 0-9
F1-F24
Plus, Minus, Space, Tab
Backspace, Delete, Insert
Home, End, PageUp, PageDown
Left, Right, Up, Down
Escape, Enter, Return
```

### Examples

```typescript
'CmdOrCtrl+S'          // Save
'CmdOrCtrl+Shift+S'    // Save As
'CmdOrCtrl+Alt+I'      // DevTools
'F11'                  // Fullscreen
'CmdOrCtrl+Plus'       // Zoom in
'CmdOrCtrl+Minus'      // Zoom out
'CmdOrCtrl+0'          // Reset zoom
'Escape'               // Cancel
```

## Registering Multiple Shortcuts

```typescript
globalShortcut.registerAll(
  ['CmdOrCtrl+1', 'CmdOrCtrl+2', 'CmdOrCtrl+3'],
  () => {
    console.log('One of the shortcuts was triggered');
  }
);
```

## Checking Registration

```typescript
if (globalShortcut.isRegistered('CmdOrCtrl+Shift+Space')) {
  console.log('Shortcut is registered');
}
```

## Unregistering Shortcuts

```typescript
// Unregister a specific shortcut
globalShortcut.unregister('CmdOrCtrl+Shift+Space');

// Unregister all shortcuts
globalShortcut.unregisterAll();
```

## Cleanup on Quit

Always unregister shortcuts when your app quits:

```typescript
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
```

## Examples

### Show/Hide Window

```typescript
globalShortcut.register('CmdOrCtrl+Shift+Space', () => {
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
});
```

### Quick Capture

```typescript
globalShortcut.register('CmdOrCtrl+Shift+C', () => {
  // Create a quick capture window
  const captureWindow = new BrowserWindow({
    width: 400,
    height: 200,
    frame: false,
    alwaysOnTop: true,
  });
  captureWindow.loadFile('capture.html');
});
```

### Toggle Recording

```typescript
let isRecording = false;

globalShortcut.register('CmdOrCtrl+Shift+R', () => {
  isRecording = !isRecording;

  if (isRecording) {
    startRecording();
    tray.setImage('/icons/recording.png');
  } else {
    stopRecording();
    tray.setImage('/icons/normal.png');
  }
});
```

### Navigate Tabs

```typescript
globalShortcut.register('CmdOrCtrl+Tab', () => {
  mainWindow.webContents.executeJavaScript('nextTab()');
});

globalShortcut.register('CmdOrCtrl+Shift+Tab', () => {
  mainWindow.webContents.executeJavaScript('previousTab()');
});
```

### Development Mode

```typescript
if (process.env.NODE_ENV === 'development') {
  globalShortcut.register('F12', () => {
    mainWindow.webContents.toggleDevTools();
  });

  globalShortcut.register('CmdOrCtrl+R', () => {
    mainWindow.reload();
  });
}
```

### Workspace Switching

```typescript
for (let i = 1; i <= 9; i++) {
  globalShortcut.register(`CmdOrCtrl+${i}`, () => {
    switchToWorkspace(i);
  });
}
```

## Platform Considerations

### Avoiding Conflicts

Some shortcuts are reserved by the OS:

| Platform | Reserved |
|----------|----------|
| macOS | Cmd+Tab, Cmd+Space, Cmd+H |
| Windows | Win+L, Ctrl+Alt+Del, Alt+Tab |
| Linux | Varies by desktop environment |

### Best Practices

1. **Use CmdOrCtrl** for cross-platform shortcuts
2. **Check isRegistered** before relying on a shortcut
3. **Provide alternatives** in case registration fails
4. **Document shortcuts** for users
5. **Allow customization** when possible

## Error Handling

```typescript
const shortcuts = [
  { accelerator: 'CmdOrCtrl+Shift+1', action: action1 },
  { accelerator: 'CmdOrCtrl+Shift+2', action: action2 },
];

const failed: string[] = [];

for (const { accelerator, action } of shortcuts) {
  if (!globalShortcut.register(accelerator, action)) {
    failed.push(accelerator);
  }
}

if (failed.length > 0) {
  console.warn('Failed to register shortcuts:', failed);
}
```

## API Reference

| Method | Description |
|--------|-------------|
| `register(accelerator, callback)` | Register a shortcut |
| `registerAll(accelerators, callback)` | Register multiple shortcuts |
| `unregister(accelerator)` | Unregister a shortcut |
| `unregisterAll()` | Unregister all shortcuts |
| `isRegistered(accelerator)` | Check if registered |

## Next Steps

- [Auto Updater](auto-updater.md) - Application updates
- [API Reference: globalShortcut](../api/global-shortcut.md)
