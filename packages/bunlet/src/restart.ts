/**
 * Main-process restart state persistence.
 *
 * When the main process restarts (during dev mode), we need to preserve
 * window positions, loaded URLs, and session data so the user's work
 * isn't disrupted.
 *
 * The state is written to a temporary file in the OS temp directory.
 * On startup, the app checks for a recovery state file and restores
 * windows from it.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const STATE_FILE_NAME = '.bunlet-restart-state.json';

export interface WindowRestoreState {
  id: number;
  url: string;
  title: string;
  bounds: { x: number; y: number; width: number; height: number };
  isMaximized: boolean;
  isFullScreen: boolean;
  partition?: string;
}

export interface RestartState {
  windows: WindowRestoreState[];
  appName: string;
  timestamp: number;
}

/**
 * Get the path to the restart state file.
 */
function getStateFilePath(): string {
  return path.join(os.tmpdir(), STATE_FILE_NAME);
}

/**
 * Save restart state for window restoration after process restart.
 *
 * Call this before restarting the main process in dev mode.
 * Returns true if state was saved successfully.
 */
export function saveRestartState(windows: WindowRestoreState[], appName: string): boolean {
  try {
    const state: RestartState = {
      windows,
      appName,
      timestamp: Date.now(),
    };
    fs.writeFileSync(getStateFilePath(), JSON.stringify(state), 'utf-8');
    return true;
  } catch (e) {
    console.warn('[bunlet] Failed to save restart state:', e);
    return false;
  }
}

/**
 * Load restart state from a previous process instance.
 *
 * Call this on app startup. Returns null if no state exists
 * or if the state is stale (older than 30 seconds).
 */
export function loadRestartState(): RestartState | null {
  try {
    const statePath = getStateFilePath();
    if (!fs.existsSync(statePath)) {
      return null;
    }

    const data = fs.readFileSync(statePath, 'utf-8');
    const state: RestartState = JSON.parse(data);

    // Clear the state file so we don't restore stale state
    fs.unlinkSync(statePath);

    // Only restore state from the last 30 seconds
    if (Date.now() - state.timestamp > 30000) {
      return null;
    }

    return state;
  } catch {
    return null;
  }
}

/**
 * Collect restore state from all open BrowserWindows.
 *
 * This is a convenience function that gathers window state
 * for the currently running app.
 */
export function collectWindowState(
  getAllWindows: () => Array<{
    id: number;
    webContents: { getURL: () => string };
    getTitle: () => string;
    getBounds: () => { x: number; y: number; width: number; height: number };
    isMaximized: () => boolean;
    isFullScreen: () => boolean;
    options?: { webPreferences?: { partition?: string } };
  }>
): WindowRestoreState[] {
  return getAllWindows().map((win) => ({
    id: win.id,
    url: win.webContents.getURL(),
    title: win.getTitle(),
    bounds: win.getBounds(),
    isMaximized: win.isMaximized(),
    isFullScreen: win.isFullScreen(),
    partition: win.options?.webPreferences?.partition,
  }));
}