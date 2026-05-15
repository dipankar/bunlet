# Menu

Create application and context menus.

```typescript
import { Menu, MenuItem } from '@bunlet/core';
```

## Menu Class

### Static Methods

#### `buildFromTemplate(template)`

Build a menu from a template.

```typescript
const menu = Menu.buildFromTemplate([
  { label: 'File', submenu: [...] },
  { label: 'Edit', submenu: [...] },
]);
```

**Returns:** `Menu`

---

#### `setApplicationMenu(menu)`

Set the application menu.

```typescript
Menu.setApplicationMenu(menu);
```

---

#### `getApplicationMenu()`

Get the current application menu.

```typescript
const menu = Menu.getApplicationMenu();
```

**Returns:** `Menu | null`

### Instance Methods

#### `append(menuItem)`

Append an item to the menu.

```typescript
menu.append(new MenuItem({ label: 'New Item' }));
```

---

#### `insert(pos, menuItem)`

Insert an item at a position.

```typescript
menu.insert(0, new MenuItem({ label: 'First Item' }));
```

---

#### `popup(options?)`

Show as context menu.

```typescript
menu.popup();
menu.popup({ x: 100, y: 100 });
menu.popup({ window: myWindow });
```

---

#### `closePopup(window?)`

Close the context menu.

```typescript
menu.closePopup();
```

---

#### `destroy()`

Destroy the menu.

```typescript
menu.destroy();
```

### Instance Properties

#### `items`

Array of menu items.

```typescript
const items = menu.items;
```

**Type:** `MenuItem[]`

## MenuItem Class

### Constructor Options

```typescript
interface MenuItemOptions {
  // Identity
  id?: string;
  label?: string;
  sublabel?: string;

  // Type
  type?: 'normal' | 'separator' | 'submenu' | 'checkbox' | 'radio';
  role?: MenuItemRole;

  // Behavior
  click?: (menuItem: MenuItem, window: BrowserWindow | null) => void;
  accelerator?: string;

  // State
  enabled?: boolean;
  visible?: boolean;
  checked?: boolean;

  // Appearance
  icon?: string;

  // Submenu
  submenu?: MenuItemOptions[] | Menu;
}
```

### Roles

Standard menu item roles:

| Role | Description |
|------|-------------|
| `undo` | Undo action |
| `redo` | Redo action |
| `cut` | Cut selection |
| `copy` | Copy selection |
| `paste` | Paste clipboard |
| `delete` | Delete selection |
| `selectAll` | Select all |
| `reload` | Reload page |
| `forceReload` | Force reload |
| `toggleDevTools` | Toggle DevTools |
| `togglefullscreen` | Toggle fullscreen |
| `resetZoom` | Reset zoom |
| `zoomIn` | Zoom in |
| `zoomOut` | Zoom out |
| `minimize` | Minimize window |
| `close` | Close window |
| `quit` | Quit app |

### Accelerators

Keyboard shortcut format:

```typescript
'CmdOrCtrl+S'      // Save
'CmdOrCtrl+Shift+S' // Save As
'Alt+F4'           // Close (Windows)
'F11'              // Fullscreen
```

## Example

```typescript
const menu = Menu.buildFromTemplate([
  {
    label: 'File',
    submenu: [
      {
        label: 'New',
        accelerator: 'CmdOrCtrl+N',
        click: () => createNewFile(),
      },
      {
        label: 'Open',
        accelerator: 'CmdOrCtrl+O',
        click: () => openFile(),
      },
      { type: 'separator' },
      {
        label: 'Save',
        accelerator: 'CmdOrCtrl+S',
        click: () => saveFile(),
      },
      { type: 'separator' },
      { role: 'quit' },
    ],
  },
  {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
    ],
  },
]);

Menu.setApplicationMenu(menu);
```
