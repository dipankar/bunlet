/**
 * Preload script for File Browser
 */

import { contextBridge, ipcRenderer } from 'bunlet';

contextBridge.exposeInMainWorld('api', {
  // Navigation
  getDirectory: (dirPath?: string) =>
    ipcRenderer.invoke('get-directory', dirPath ? { path: dirPath } : {}),
  navigateTo: (dirPath: string) =>
    ipcRenderer.invoke('navigate-to', { path: dirPath }),
  navigateBack: () => ipcRenderer.invoke('navigate-back'),
  navigateForward: () => ipcRenderer.invoke('navigate-forward'),
  navigateUp: () => ipcRenderer.invoke('navigate-up'),
  getNavState: () => ipcRenderer.invoke('get-nav-state'),

  // Dialogs
  openFolderDialog: () => ipcRenderer.invoke('open-folder-dialog'),

  // File operations
  openFile: (filePath: string) =>
    ipcRenderer.invoke('open-file', { path: filePath }),
  showInFolder: (filePath: string) =>
    ipcRenderer.invoke('show-in-folder', { path: filePath }),

  // Events
  onDirectoryChanged: (
    callback: (event: { type: string; paths: string[] }) => void
  ) => {
    ipcRenderer.on('directory-changed', (_event, data) => callback(data as { type: string; paths: string[] }));
  },
});
