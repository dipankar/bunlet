/**
 * Clipboard API for Bunlet
 *
 * Provides cross-platform clipboard operations.
 */

import { assertRuntimeCapability } from './runtime/capabilities';
import { native } from './runtime';

/**
 * Clipboard module for reading and writing clipboard content
 */
export const clipboard = {
  /**
   * Read text from the clipboard
   * @returns The text content from clipboard
   */
  readText(): string {
    assertRuntimeCapability('clipboard', 'clipboard.readText()');
    return native.clipboardReadText();
  },

  /**
   * Write text to the clipboard
   * @param text - The text to write to clipboard
   */
  writeText(text: string): void {
    assertRuntimeCapability('clipboard', 'clipboard.writeText()');
    native.clipboardWriteText(text);
  },

  /**
   * Clear the clipboard
   */
  clear(): void {
    assertRuntimeCapability('clipboard', 'clipboard.clear()');
    native.clipboardClear();
  },

  /**
   * Check if clipboard has text content
   * @returns True if clipboard contains text
   */
  hasText(): boolean {
    assertRuntimeCapability('clipboard', 'clipboard.hasText()');
    return native.clipboardHasText();
  },
};
