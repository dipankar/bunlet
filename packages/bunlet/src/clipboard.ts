/**
 * Clipboard API for Bunlet
 *
 * Provides cross-platform clipboard operations.
 */

import native from './native/bindings';

/**
 * Clipboard module for reading and writing clipboard content
 */
export const clipboard = {
  /**
   * Read text from the clipboard
   * @returns The text content from clipboard
   */
  readText(): string {
    return native.clipboardReadText();
  },

  /**
   * Write text to the clipboard
   * @param text - The text to write to clipboard
   */
  writeText(text: string): void {
    native.clipboardWriteText(text);
  },

  /**
   * Clear the clipboard
   */
  clear(): void {
    native.clipboardClear();
  },

  /**
   * Check if clipboard has text content
   * @returns True if clipboard contains text
   */
  hasText(): boolean {
    return native.clipboardHasText();
  },
};
