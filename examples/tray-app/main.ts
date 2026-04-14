/**
 * System Tray App Demo
 *
 * Demonstrates:
 * - System tray icon
 * - Context menus
 * - Notifications with action buttons
 * - Global shortcuts
 * - Minimize to tray
 */

import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  MenuItem,
  Notification,
  globalShortcut,
} from 'bunlet';
import path from 'path';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

// Configuration
const config = {
  trayIcon: path.join(import.meta.dir, 'assets', 'tray-icon.png'),
  showNotificationShortcut: 'CommandOrControl+Shift+N',
  toggleWindowShortcut: 'CommandOrControl+Shift+T',
};

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 500,
    title: 'Tray App Demo',
    show: true,
  });

  mainWindow.loadFile(path.join(import.meta.dir, 'index.html'));

  // Minimize to tray instead of closing
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
      showNotification(
        'Minimized to Tray',
        'The app is still running in the system tray'
      );
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  try {
    tray = new Tray(config.trayIcon);
    tray.setToolTip('Tray App Demo');

    // Create context menu
    const contextMenu = new Menu();

    contextMenu.append(
      new MenuItem({
        label: 'Show Window',
        click: () => {
          showWindow();
        },
      })
    );

    contextMenu.append(
      new MenuItem({
        label: 'Hide Window',
        click: () => {
          mainWindow?.hide();
        },
      })
    );

    contextMenu.append(new MenuItem({ type: 'separator' }));

    contextMenu.append(
      new MenuItem({
        label: 'Send Test Notification',
        click: () => {
          showNotification(
            'Test Notification',
            'This is a test notification from the tray menu',
            true
          );
        },
      })
    );

    contextMenu.append(new MenuItem({ type: 'separator' }));

    contextMenu.append(
      new MenuItem({
        label: 'Quit',
        click: () => {
          isQuitting = true;
          app.quit();
        },
      })
    );

    tray.setContextMenu(contextMenu);

    // Double-click on tray icon shows window
    tray.on('double-click', () => {
      showWindow();
    });

    console.log('Tray created successfully');
  } catch (error) {
    console.error('Failed to create tray:', error);
    // Continue without tray on systems that don't support it
  }
}

function registerShortcuts() {
  // Toggle window visibility
  globalShortcut.register(config.toggleWindowShortcut, () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      showWindow();
    }
  });

  // Show notification
  globalShortcut.register(config.showNotificationShortcut, () => {
    showNotification(
      'Shortcut Triggered',
      `You pressed ${config.showNotificationShortcut}`,
      true
    );
  });

  console.log('Global shortcuts registered');
}

function showWindow() {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
}

function showNotification(
  title: string,
  body: string,
  withActions = false
) {
  const options: {
    title: string;
    body: string;
    actions?: Array<{ type: 'button'; text: string }>;
  } = {
    title,
    body,
  };

  if (withActions) {
    options.actions = [
      { type: 'button', text: 'Show Window' },
      { type: 'button', text: 'Dismiss' },
    ];
  }

  const notification = new Notification(options);

  notification.on('click', () => {
    showWindow();
  });

  notification.on('action', (_event, actionIndex) => {
    if (actionIndex === 0) {
      showWindow();
    }
  });

  notification.show();
}

app.on('before-quit', () => {
  isQuitting = true;
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  // Don't quit on window close - we're a tray app
  // Quit is handled through the tray menu
});

// Wait for app to be ready
await app.whenReady();
console.log('Tray App Demo is ready!');

// Create window and tray
createWindow();
createTray();
registerShortcuts();

// Show welcome notification after a delay
setTimeout(() => {
  showNotification(
    'Tray App Started',
    `Press ${config.toggleWindowShortcut} to toggle window visibility`
  );
}, 1000);

// Run the event loop
console.log('About to run app...');
app.run();
