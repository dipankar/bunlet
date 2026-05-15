/**
 * Power Monitor Demo
 *
 * Demonstrates:
 * - Battery status monitoring
 * - Power events (AC/battery switching)
 * - System idle detection
 * - Suspend/resume events
 */

import { app, BrowserWindow, powerMonitor, z } from '@bunlet/core';
import path from 'path';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 450,
    height: 550,
    title: 'Power Monitor',
    resizable: false,
    webPreferences: {
      preload: path.join(import.meta.dir, 'preload.ts'),
    },
  });

  // Note: center() is disabled on Linux due to screen API limitations
  // mainWindow.center();
  mainWindow.loadFile(path.join(import.meta.dir, 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function setupPowerMonitoring() {
  // Power source changes
  powerMonitor.on('on-ac', () => {
    mainWindow?.webContents.send('power-event', {
      type: 'on-ac',
      message: 'Switched to AC power',
      timestamp: Date.now(),
    });
  });

  powerMonitor.on('on-battery', () => {
    mainWindow?.webContents.send('power-event', {
      type: 'on-battery',
      message: 'Switched to battery power',
      timestamp: Date.now(),
    });
  });

  // Suspend/resume
  powerMonitor.on('suspend', () => {
    mainWindow?.webContents.send('power-event', {
      type: 'suspend',
      message: 'System is suspending',
      timestamp: Date.now(),
    });
  });

  powerMonitor.on('resume', () => {
    mainWindow?.webContents.send('power-event', {
      type: 'resume',
      message: 'System has resumed',
      timestamp: Date.now(),
    });
  });

  // Lock screen
  powerMonitor.on('lock-screen', () => {
    mainWindow?.webContents.send('power-event', {
      type: 'lock-screen',
      message: 'Screen locked',
      timestamp: Date.now(),
    });
  });

  powerMonitor.on('unlock-screen', () => {
    mainWindow?.webContents.send('power-event', {
      type: 'unlock-screen',
      message: 'Screen unlocked',
      timestamp: Date.now(),
    });
  });

  console.log('Power monitoring initialized');
}

// Register IPC handlers before app is ready
// Get battery info
app.handle('get-battery-info', z.object({}), async () => {
  return powerMonitor.getBatteryInfo();
});

// Get power state
app.handle('get-power-state', z.object({}), async () => {
  return {
    onBattery: powerMonitor.isOnBatteryPower(),
    idleState: powerMonitor.getSystemIdleState(60),
    idleTime: powerMonitor.getSystemIdleTime(),
    thermalState: powerMonitor.getCurrentThermalState(),
  };
});

// Check idle state with custom threshold
app.handle(
  'get-idle-state',
  z.object({ threshold: z.number().optional() }),
  async (params) => {
    const threshold = params?.threshold || 60;
    return {
      state: powerMonitor.getSystemIdleState(threshold),
      idleTime: powerMonitor.getSystemIdleTime(),
    };
  }
);

app.on('window-all-closed', () => {
  app.quit();
});

// Wait for app to be ready
await app.whenReady();
console.log('Power Monitor is ready!');

// Create window and setup monitoring
createWindow();
setupPowerMonitoring();

// Run the event loop
console.log('About to run app...');
app.run();
