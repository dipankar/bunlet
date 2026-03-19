/**
 * Application Menu for Notes App
 */

import { Menu, shell, dialog } from 'bunlet';
import type { BrowserWindow } from 'bunlet';
import type { MenuItemOptions } from 'bunlet';

export function createAppMenu(mainWindow: BrowserWindow): Menu {
  const isMac = process.platform === 'darwin';

  const template: MenuItemOptions[] = [
    // macOS app menu
    ...(isMac
      ? [
          {
            label: 'Notes App',
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              {
                label: 'Preferences...',
                accelerator: 'Cmd+,',
                click: () => mainWindow.send('menu:preferences'),
              },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),

    // File menu
    {
      label: 'File',
      submenu: [
        {
          label: 'New Note',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow.send('menu:new-note'),
        },
        { type: 'separator' as const },
        {
          label: 'Export as PDF...',
          accelerator: 'CmdOrCtrl+Shift+E',
          click: () => mainWindow.send('menu:export-pdf'),
        },
        {
          label: 'Export as Markdown...',
          accelerator: 'CmdOrCtrl+Shift+M',
          click: () => mainWindow.send('menu:export-markdown'),
        },
        { type: 'separator' as const },
        isMac ? { role: 'close' as const } : { role: 'quit' as const },
      ],
    },

    // Edit menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        { role: 'delete' as const },
        { type: 'separator' as const },
        { role: 'selectAll' as const },
        { type: 'separator' as const },
        {
          label: 'Find...',
          accelerator: 'CmdOrCtrl+F',
          click: () => mainWindow.send('menu:find'),
        },
      ],
    },

    // View menu
    {
      label: 'View',
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        { role: 'toggleDevTools' as const },
        { type: 'separator' as const },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const },
        { type: 'separator' as const },
        {
          label: 'Toggle Preview',
          accelerator: 'CmdOrCtrl+P',
          click: () => mainWindow.send('menu:toggle-preview'),
        },
        {
          label: 'Toggle Sidebar',
          accelerator: 'CmdOrCtrl+B',
          click: () => mainWindow.send('menu:toggle-sidebar'),
        },
      ],
    },

    // Help menu
    {
      label: 'Help',
      submenu: [
        {
          label: 'Markdown Guide',
          click: () => shell.openExternal('https://www.markdownguide.org/'),
        },
        {
          label: 'Keyboard Shortcuts',
          accelerator: 'CmdOrCtrl+/',
          click: () => mainWindow.send('menu:shortcuts'),
        },
        { type: 'separator' as const },
        {
          label: 'About Notes App',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About Notes App',
              message: 'Notes App v1.0.0',
              detail: 'A beautiful notes app built with Bunlet',
            });
          },
        },
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}
