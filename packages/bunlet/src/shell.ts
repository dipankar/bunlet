/**
 * Shell API for Bunlet
 *
 * Provides cross-platform shell operations like opening URLs,
 * files, and showing items in folder.
 */

import native from './native/bindings';

/**
 * Options for opening external URLs
 */
export interface OpenExternalOptions {
  /**
   * Bring the opened application to the foreground (macOS only)
   */
  activate?: boolean;
  /**
   * Working directory for the opened application
   */
  workingDirectory?: string;
}

/**
 * Shell module for system operations
 */
export const shell = {
  /**
   * Open a URL in the default browser
   * @param url - The URL to open
   * @param options - Additional options
   */
  async openExternal(url: string, _options?: OpenExternalOptions): Promise<void> {
    await native.shellOpenExternal(url);
  },

  /**
   * Open a file or directory with the default application
   * @param path - Path to the file or directory
   * @returns Error message if failed, empty string on success
   */
  async openPath(path: string): Promise<string> {
    return await native.shellOpenPath(path);
  },

  /**
   * Show an item in the file manager with the item selected
   * @param fullPath - Full path to the item
   */
  showItemInFolder(fullPath: string): void {
    native.shellShowItemInFolder(fullPath);
  },

  /**
   * Move an item to the trash/recycle bin
   * @param path - Path to the item to trash
   */
  async trashItem(path: string): Promise<void> {
    await native.shellTrashItem(path);
  },

  /**
   * Play the system beep sound
   */
  beep(): void {
    native.shellBeep();
  },
};
