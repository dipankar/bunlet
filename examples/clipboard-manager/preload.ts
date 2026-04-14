/**
 * Preload script for Clipboard Manager
 */

import { contextBridge, ipcRenderer } from 'bunlet';

contextBridge.exposeInMainWorld('api', {
  // Get clipboard history
  getHistory: () => ipcRenderer.invoke('get-history'),

  // Copy text to clipboard
  copyToClipboard: (text: string) =>
    ipcRenderer.invoke('copy-to-clipboard', { text }),

  // Get current clipboard content
  getClipboard: () => ipcRenderer.invoke('get-clipboard'),

  // Clear history
  clearHistory: () => ipcRenderer.invoke('clear-history'),

  // Clear clipboard
  clearClipboard: () => ipcRenderer.invoke('clear-clipboard'),

  // Remove item from history
  removeItem: (index: number) => ipcRenderer.invoke('remove-item', { index }),

  // Listen for history updates
  onHistoryUpdated: (
    callback: (history: Array<{ text: string; timestamp: number }>) => void
  ) => {
    ipcRenderer.on('history-updated', (_event, data) => callback(data as Array<{ text: string; timestamp: number }>));
  },
});
