/**
 * Preload script for Power Monitor
 */

import { contextBridge, ipcRenderer } from 'bunlet';

contextBridge.exposeInMainWorld('api', {
  // Get battery information
  getBatteryInfo: () => ipcRenderer.invoke('get-battery-info'),

  // Get power state
  getPowerState: () => ipcRenderer.invoke('get-power-state'),

  // Get idle state with custom threshold
  getIdleState: (threshold?: number) =>
    ipcRenderer.invoke('get-idle-state', { threshold }),

  // Listen for power events
  onPowerEvent: (
    callback: (event: {
      type: string;
      message: string;
      timestamp: number;
    }) => void
  ) => {
    ipcRenderer.on('power-event', (_event, data) => callback(data as { type: string; message: string; timestamp: number }));
  },
});
