/**
 * Dialog API for Bunlet
 *
 * Provides cross-platform file dialogs and message boxes.
 */

import native from './native/bindings';
import type { BrowserWindow } from './browser-window';

/**
 * File filter for dialogs
 */
export interface FileFilter {
  /** Display name for the filter (e.g., "Images") */
  name: string;
  /** File extensions without dots (e.g., ["png", "jpg", "gif"]) */
  extensions: string[];
}

/**
 * Options for the open dialog
 */
export interface OpenDialogOptions {
  /** Dialog title */
  title?: string;
  /** Default path to open in */
  defaultPath?: string;
  /** Custom label for the confirmation button */
  buttonLabel?: string;
  /** File type filters */
  filters?: FileFilter[];
  /** Properties controlling dialog behavior */
  properties?: Array<
    | 'openFile'
    | 'openDirectory'
    | 'multiSelections'
    | 'showHiddenFiles'
    | 'createDirectory'
    | 'promptToCreate'
  >;
}

/**
 * Return value from open dialog
 */
export interface OpenDialogReturnValue {
  /** Whether the dialog was canceled */
  canceled: boolean;
  /** Selected file paths (empty if canceled) */
  filePaths: string[];
}

/**
 * Options for the save dialog
 */
export interface SaveDialogOptions {
  /** Dialog title */
  title?: string;
  /** Default path and filename */
  defaultPath?: string;
  /** Custom label for the confirmation button */
  buttonLabel?: string;
  /** File type filters */
  filters?: FileFilter[];
  /** Properties controlling dialog behavior */
  properties?: Array<'showHiddenFiles' | 'createDirectory'>;
}

/**
 * Return value from save dialog
 */
export interface SaveDialogReturnValue {
  /** Whether the dialog was canceled */
  canceled: boolean;
  /** Selected file path (undefined if canceled) */
  filePath?: string;
}

/**
 * Options for message box
 */
export interface MessageBoxOptions {
  /** Type of message box */
  type?: 'none' | 'info' | 'error' | 'question' | 'warning';
  /** Button labels */
  buttons?: string[];
  /** Index of the default button */
  defaultId?: number;
  /** Dialog title */
  title?: string;
  /** Primary message */
  message: string;
  /** Secondary message with more details */
  detail?: string;
  /** Checkbox label (if shown) */
  checkboxLabel?: string;
  /** Initial checkbox state */
  checkboxChecked?: boolean;
  /** Index of the cancel button */
  cancelId?: number;
  /** Don't use sheet style on macOS */
  noLink?: boolean;
}

/**
 * Return value from message box
 */
export interface MessageBoxReturnValue {
  /** Index of the clicked button */
  response: number;
  /** State of the checkbox (if shown) */
  checkboxChecked?: boolean;
}

/**
 * Dialog module for file and message dialogs
 */
export const dialog = {
  /**
   * Show an open file dialog
   * @param browserWindow - Parent window (optional, can be null)
   * @param options - Dialog options
   */
  async showOpenDialog(
    _browserWindow: BrowserWindow | null,
    options: OpenDialogOptions
  ): Promise<OpenDialogReturnValue> {
    const properties = options.properties || ['openFile'];

    const result = await native.showOpenDialog({
      title: options.title,
      defaultPath: options.defaultPath,
      buttonLabel: options.buttonLabel,
      filters: options.filters?.map((f) => ({
        name: f.name,
        extensions: f.extensions,
      })),
      openFile: properties.includes('openFile'),
      openDirectory: properties.includes('openDirectory'),
      multiSelections: properties.includes('multiSelections'),
    });

    return {
      canceled: result.canceled,
      filePaths: result.filePaths,
    };
  },

  /**
   * Show a save file dialog
   * @param browserWindow - Parent window (optional, can be null)
   * @param options - Dialog options
   */
  async showSaveDialog(
    _browserWindow: BrowserWindow | null,
    options: SaveDialogOptions
  ): Promise<SaveDialogReturnValue> {
    const result = await native.showSaveDialog({
      title: options.title,
      defaultPath: options.defaultPath,
      buttonLabel: options.buttonLabel,
      filters: options.filters?.map((f) => ({
        name: f.name,
        extensions: f.extensions,
      })),
    });

    return {
      canceled: result.canceled,
      filePath: result.filePath ?? undefined,
    };
  },

  /**
   * Show a message box
   * @param browserWindow - Parent window (optional, can be null)
   * @param options - Dialog options
   */
  async showMessageBox(
    _browserWindow: BrowserWindow | null,
    options: MessageBoxOptions
  ): Promise<MessageBoxReturnValue> {
    const result = await native.showMessageBox({
      messageType: options.type,
      title: options.title,
      message: options.message,
      detail: options.detail,
      buttons: options.buttons,
      defaultId: options.defaultId,
      cancelId: options.cancelId,
    });

    return {
      response: result.response,
    };
  },

  /**
   * Show an error box (synchronous)
   * @param title - Error title
   * @param content - Error message
   */
  showErrorBox(title: string, content: string): void {
    native.showErrorBox(title, content);
  },
};
