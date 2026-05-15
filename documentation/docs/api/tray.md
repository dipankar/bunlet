# Tray

Create system tray icons with context menus.

```typescript
import { Tray } from '@bunlet/core';
```

## Constructor

```typescript
new Tray(iconPath: string)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `iconPath` | `string` | Path to tray icon image |

## Instance Methods

### `setImage(path)`

Set the tray icon image.

```typescript
tray.setImage('/path/to/icon.png');
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `path` | `string` | Path to new icon |

---

### `setToolTip(toolTip)`

Set the hover tooltip text.

```typescript
tray.setToolTip('My Application');
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `toolTip` | `string` | Tooltip text |

---

### `setTitle(title)`

Set the tray title (macOS only).

```typescript
tray.setTitle('Status: Online');
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `title` | `string` | Title text |

---

### `setContextMenu(menu)`

Set the context menu for the tray icon.

```typescript
const menu = Menu.buildFromTemplate([
  { label: 'Show', click: () => win.show() },
  { label: 'Quit', role: 'quit' },
]);
tray.setContextMenu(menu);
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `menu` | `Menu \| null` | Context menu |

---

### `destroy()`

Destroy the tray icon.

```typescript
tray.destroy();
```

---

### `isDestroyed()`

Check if tray is destroyed.

```typescript
if (!tray.isDestroyed()) {
  tray.setToolTip('Still active');
}
```

**Returns:** `boolean`

## Events

### `click`

Emitted when tray icon is clicked.

```typescript
tray.on('click', (event) => {
  mainWindow.show();
});
```

---

### `right-click`

Emitted when tray icon is right-clicked.

```typescript
tray.on('right-click', (event) => {
  tray.popUpContextMenu();
});
```

---

### `double-click`

Emitted when tray icon is double-clicked.

```typescript
tray.on('double-click', (event) => {
  mainWindow.show();
  mainWindow.focus();
});
```

## Example

```typescript
import { app, Tray, Menu, BrowserWindow } from '@bunlet/core';

let tray: Tray | null = null;

app.whenReady().then(() => {
  const win = new BrowserWindow();

  tray = new Tray('/path/to/icon.png');
  tray.setToolTip('My App');

  const menu = Menu.buildFromTemplate([
    {
      label: 'Show Window',
      click: () => {
        win.show();
        win.focus();
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => app.quit(),
    },
  ]);

  tray.setContextMenu(menu);

  tray.on('click', () => {
    win.isVisible() ? win.hide() : win.show();
  });
});
```
