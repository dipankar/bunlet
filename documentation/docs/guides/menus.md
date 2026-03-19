# Menus

Create application menus and context menus in Bunlet.

## Application Menu

Set the application's main menu bar:

```typescript
import { Menu, MenuItem, BrowserWindow } from 'bunlet';

const menu = Menu.buildFromTemplate([
  {
    label: 'File',
    submenu: [
      { label: 'New', accelerator: 'CmdOrCtrl+N', click: () => createNewFile() },
      { label: 'Open', accelerator: 'CmdOrCtrl+O', click: () => openFile() },
      { type: 'separator' },
      { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => saveFile() },
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
      { role: 'selectAll' },
    ],
  },
  {
    label: 'View',
    submenu: [
      { role: 'reload' },
      { role: 'forceReload' },
      { role: 'toggleDevTools' },
      { type: 'separator' },
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' },
    ],
  },
]);

Menu.setApplicationMenu(menu);
```

## Menu Item Types

### Normal Items

```typescript
{
  label: 'Open File',
  accelerator: 'CmdOrCtrl+O',
  click: (menuItem, window) => {
    // Handle click
  },
}
```

### Checkbox Items

```typescript
{
  label: 'Show Sidebar',
  type: 'checkbox',
  checked: true,
  click: (menuItem) => {
    console.log('Checked:', menuItem.checked);
  },
}
```

### Radio Items

```typescript
{
  label: 'View Mode',
  submenu: [
    { label: 'List', type: 'radio', checked: true },
    { label: 'Grid', type: 'radio' },
    { label: 'Gallery', type: 'radio' },
  ],
}
```

### Separators

```typescript
{ type: 'separator' }
```

### Submenus

```typescript
{
  label: 'Recent Files',
  submenu: [
    { label: 'document1.txt' },
    { label: 'document2.txt' },
    { label: 'document3.txt' },
  ],
}
```

## Roles

Use built-in roles for standard menu items:

```typescript
{ role: 'undo' }
{ role: 'redo' }
{ role: 'cut' }
{ role: 'copy' }
{ role: 'paste' }
{ role: 'delete' }
{ role: 'selectAll' }
{ role: 'reload' }
{ role: 'forceReload' }
{ role: 'toggleDevTools' }
{ role: 'togglefullscreen' }
{ role: 'minimize' }
{ role: 'close' }
{ role: 'quit' }
{ role: 'resetZoom' }
{ role: 'zoomIn' }
{ role: 'zoomOut' }
```

### macOS-Specific Roles

```typescript
{ role: 'about' }
{ role: 'services' }
{ role: 'hide' }
{ role: 'hideOthers' }
{ role: 'unhide' }
{ role: 'startSpeaking' }
{ role: 'stopSpeaking' }
```

### Menu Roles (Full Submenus)

```typescript
{ role: 'appMenu' }      // macOS app menu
{ role: 'fileMenu' }     // Standard File menu
{ role: 'editMenu' }     // Standard Edit menu
{ role: 'viewMenu' }     // Standard View menu
{ role: 'windowMenu' }   // Standard Window menu
```

## Keyboard Accelerators

Define keyboard shortcuts with accelerators:

```typescript
// Cross-platform
{ accelerator: 'CmdOrCtrl+S' }  // Cmd+S on macOS, Ctrl+S elsewhere

// Platform-specific
{ accelerator: 'Ctrl+S' }
{ accelerator: 'Command+S' }
{ accelerator: 'Alt+S' }

// Key combinations
{ accelerator: 'CmdOrCtrl+Shift+S' }
{ accelerator: 'CmdOrCtrl+Alt+S' }

// Special keys
{ accelerator: 'CmdOrCtrl+Plus' }
{ accelerator: 'CmdOrCtrl+Minus' }
{ accelerator: 'F11' }
{ accelerator: 'Escape' }
```

## Context Menus

Create right-click menus:

```typescript
import { Menu } from 'bunlet';

const contextMenu = Menu.buildFromTemplate([
  { label: 'Cut', role: 'cut' },
  { label: 'Copy', role: 'copy' },
  { label: 'Paste', role: 'paste' },
  { type: 'separator' },
  { label: 'Select All', role: 'selectAll' },
]);

// Show at specific position
contextMenu.popup({ x: 100, y: 100 });

// Show in a specific window
contextMenu.popup({ window: myWindow });
```

### Triggering from Renderer

```typescript
// Main process
app.handle('show-context-menu', z.object({
  x: z.number(),
  y: z.number(),
}), async ({ x, y }, { window }) => {
  const menu = Menu.buildFromTemplate([
    { label: 'Option 1', click: () => {} },
    { label: 'Option 2', click: () => {} },
  ]);
  menu.popup({ window, x, y });
  return true;
});
```

```javascript
// Renderer
document.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  invoke('show-context-menu', { x: e.clientX, y: e.clientY });
});
```

## Dynamic Menus

Update menus at runtime:

```typescript
// Store reference
let recentFilesMenu: Menu;

function updateRecentFiles(files: string[]) {
  recentFilesMenu = Menu.buildFromTemplate(
    files.map(file => ({
      label: file,
      click: () => openFile(file),
    }))
  );

  // Rebuild main menu with updated submenu
  rebuildApplicationMenu();
}
```

## Menu Item Properties

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
  click?: (menuItem, window) => void;
  accelerator?: string;

  // State
  enabled?: boolean;
  visible?: boolean;
  checked?: boolean;  // For checkbox/radio

  // Appearance
  icon?: string;  // Path to icon

  // Submenu
  submenu?: MenuItemOptions[] | Menu;
}
```

## macOS App Menu

On macOS, the first menu should be the app menu:

```typescript
const isMac = process.platform === 'darwin';

const template = [
  // App menu (macOS only)
  ...(isMac ? [{
    label: app.getName(),
    submenu: [
      { role: 'about' },
      { type: 'separator' },
      { role: 'services' },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideOthers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit' },
    ],
  }] : []),
  // File menu
  {
    label: 'File',
    submenu: [
      isMac ? { role: 'close' } : { role: 'quit' },
    ],
  },
  // ... more menus
];
```

## Enabling/Disabling Items

```typescript
// Access by ID
const menu = Menu.buildFromTemplate([
  { id: 'save', label: 'Save', enabled: false },
]);

// Update later
const saveItem = menu.items.find(item => item.id === 'save');
if (saveItem) {
  saveItem.enabled = true;
}
```

## Next Steps

- [Dialogs](dialogs.md) - File and message dialogs
- [API Reference: Menu](../api/menu.md)
