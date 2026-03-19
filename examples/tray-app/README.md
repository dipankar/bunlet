# Tray App Demo

A system tray application demo for bunlet.

## Features Demonstrated

- **System Tray Icon** - Application lives in the system tray
- **Context Menu** - Right-click menu with options
- **Notifications** - Desktop notifications with action buttons
- **Global Shortcuts** - System-wide keyboard shortcuts
- **Minimize to Tray** - Window hides to tray instead of closing

## Setup

Before running, you need to add a tray icon:

1. Add a PNG image (recommended 32x32 or 64x64 pixels) to `assets/tray-icon.png`
2. The icon should have a transparent background for best results

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+T` | Toggle window visibility |
| `Ctrl+Shift+N` | Show test notification |

## Running

```bash
# Install dependencies
bun install

# Run in development mode
bun run dev
```

## Notes

- On Linux, the system tray (AppIndicator) support depends on the desktop environment
- On some systems, you may need to install additional packages for tray support
