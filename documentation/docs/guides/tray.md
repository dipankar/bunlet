# System Tray

Create system tray icons with context menus.

## Basic Tray

```typescript
import { Tray, Menu } from '@bunlet/core';

const tray = new Tray('/path/to/icon.png');
tray.setToolTip('My Application');
```

## Tray with Context Menu

```typescript
const tray = new Tray('/path/to/icon.png');

const contextMenu = Menu.buildFromTemplate([
  { label: 'Show App', click: () => mainWindow.show() },
  { label: 'Settings', click: () => openSettings() },
  { type: 'separator' },
  { label: 'Quit', click: () => app.quit() },
]);

tray.setContextMenu(contextMenu);
```

## Tray Events

```typescript
const tray = new Tray('/path/to/icon.png');

tray.on('click', (event, bounds) => {
  // Toggle window visibility on click
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
  }
});

tray.on('right-click', (event, bounds) => {
  // Show context menu on right-click
  tray.popUpContextMenu();
});

tray.on('double-click', (event, bounds) => {
  // Open app on double-click
  mainWindow.show();
  mainWindow.focus();
});
```

## Tray Properties

```typescript
// Change icon
tray.setImage('/path/to/new-icon.png');

// Set tooltip
tray.setToolTip('Status: Online');

// Set title (macOS only - appears next to icon)
tray.setTitle('5');

// Get bounds
const bounds = tray.getBounds();
// { x: number, y: number, width: number, height: number }
```

## Dynamic Updates

```typescript
let unreadCount = 0;

function updateTray(count: number) {
  unreadCount = count;

  if (count > 0) {
    tray.setImage('/path/to/icon-badge.png');
    tray.setTitle(count.toString());
    tray.setToolTip(`${count} unread messages`);
  } else {
    tray.setImage('/path/to/icon.png');
    tray.setTitle('');
    tray.setToolTip('No new messages');
  }
}
```

## Positioning Windows Near Tray

```typescript
tray.on('click', (event, bounds) => {
  const windowBounds = mainWindow.getBounds();

  // Position window near tray icon
  const x = Math.round(bounds.x + bounds.width / 2 - windowBounds.width / 2);
  const y = bounds.y + bounds.height;

  mainWindow.setPosition(x, y);
  mainWindow.show();
});
```

## Destroy Tray

```typescript
// Remove the tray icon
tray.destroy();

// Check if destroyed
if (tray.isDestroyed()) {
  console.log('Tray has been removed');
}
```

## Examples

### Minimize to Tray

```typescript
import { app, BrowserWindow, Tray, Menu } from '@bunlet/core';

let mainWindow: BrowserWindow;
let tray: Tray;

await app.whenReady();

mainWindow = new BrowserWindow({ width: 800, height: 600 });
mainWindow.loadFile('index.html');

// Create tray
tray = new Tray('/path/to/icon.png');
tray.setToolTip('My App');
tray.setContextMenu(Menu.buildFromTemplate([
  { label: 'Show', click: () => mainWindow.show() },
  { label: 'Quit', click: () => app.quit() },
]));

// Minimize to tray instead of closing
mainWindow.on('close', (event) => {
  if (!app.isQuitting) {
    event.preventDefault();
    mainWindow.hide();
  }
});

// Show on tray click
tray.on('click', () => {
  mainWindow.show();
});

app.run();
```

### Status Indicator

```typescript
type Status = 'online' | 'away' | 'busy' | 'offline';

const icons: Record<Status, string> = {
  online: '/icons/tray-online.png',
  away: '/icons/tray-away.png',
  busy: '/icons/tray-busy.png',
  offline: '/icons/tray-offline.png',
};

function setStatus(status: Status) {
  tray.setImage(icons[status]);
  tray.setToolTip(`Status: ${status}`);
}
```

### Menu with Status

```typescript
let isRecording = false;

function updateTrayMenu() {
  const menu = Menu.buildFromTemplate([
    {
      label: isRecording ? 'Stop Recording' : 'Start Recording',
      click: () => {
        isRecording = !isRecording;
        updateTrayMenu();
      },
    },
    { type: 'separator' },
    { label: 'Settings', click: () => openSettings() },
    { label: 'Quit', click: () => app.quit() },
  ]);

  tray.setContextMenu(menu);
  tray.setImage(isRecording ? '/icons/recording.png' : '/icons/normal.png');
}

updateTrayMenu();
```

## Icon Guidelines

### Sizes

| Platform | Recommended Size |
|----------|-----------------|
| Windows | 16x16, 32x32 |
| macOS | 22x22 (template images) |
| Linux | 22x22, 24x24 |

### Format

- Use PNG format with transparency
- On macOS, use template images (black icons that adapt to light/dark mode)

### Creating Icons

```bash
# Example using ImageMagick
convert icon.png -resize 22x22 tray-icon.png
```

## Platform Differences

| Feature | Windows | macOS | Linux |
|---------|---------|-------|-------|
| Tray icon | Yes | Yes | Yes |
| Context menu | Yes | Yes | Yes |
| Click event | Yes | Yes | Yes |
| Title text | No | Yes | Limited |
| Balloon notifications | Yes | No | No |

## Next Steps

- [Clipboard](clipboard.md) - Clipboard operations
- [API Reference: Tray](../api/tray.md)
