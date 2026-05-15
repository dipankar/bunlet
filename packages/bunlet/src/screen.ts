/**
 * Screen/Display API for bunlet
 *
 * Provides information about the system displays/monitors.
 *
 * @example
 * ```typescript
 * import { screen } from '@bunlet/core';
 *
 * // Get primary display
 * const primary = screen.getPrimaryDisplay();
 * console.log(`Primary display: ${primary.bounds.width}x${primary.bounds.height}`);
 *
 * // Get all displays
 * const displays = screen.getAllDisplays();
 * displays.forEach((d, i) => {
 *   console.log(`Display ${i}: ${d.bounds.width}x${d.bounds.height} at (${d.bounds.x}, ${d.bounds.y})`);
 * });
 * ```
 */

import type { Rectangle } from './types';
import { assertRuntimeCapability } from './runtime/capabilities';
import { native } from './runtime';

/**
 * Display information
 */
export interface Display {
  /** Unique display identifier */
  id: number;
  /** Display label/name (may be empty on some platforms) */
  label: string;
  /** Full display bounds in virtual screen coordinates */
  bounds: Rectangle;
  /** Work area bounds (excludes taskbar/dock) */
  workArea: Rectangle;
  /** DPI scale factor (e.g., 1.0, 1.25, 2.0) */
  scaleFactor: number;
  /** Whether this is the primary display */
  primary: boolean;
  /** Display rotation in degrees (0, 90, 180, 270) */
  rotation: number;
  /** Display size in pixels */
  size: { width: number; height: number };
}

/**
 * Point on screen
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Convert native DisplayInfo to Display interface
 */
function toDisplay(info: {
  id: number;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  work_area_x: number;
  work_area_y: number;
  work_area_width: number;
  work_area_height: number;
  scale_factor: number;
  is_primary: boolean;
}): Display {
  return {
    id: info.id,
    label: info.name,
    bounds: {
      x: info.x,
      y: info.y,
      width: info.width,
      height: info.height,
    },
    workArea: {
      x: info.work_area_x,
      y: info.work_area_y,
      width: info.work_area_width,
      height: info.work_area_height,
    },
    scaleFactor: info.scale_factor,
    primary: info.is_primary,
    rotation: 0, // TAO doesn't expose rotation
    size: {
      width: info.width,
      height: info.height,
    },
  };
}

/**
 * Screen API singleton
 */
export const screen = {
  /**
   * Get the primary display
   * @returns The primary display information
   */
  getPrimaryDisplay(): Display {
    assertRuntimeCapability('screen', 'screen.getPrimaryDisplay()');
    const info = native.getPrimaryDisplay();
    return toDisplay(info);
  },

  /**
   * Get all available displays
   * @returns Array of all display information
   */
  getAllDisplays(): Display[] {
    assertRuntimeCapability('screen', 'screen.getAllDisplays()');
    const infos = native.getAllDisplays();
    return infos.map(toDisplay);
  },

  /**
   * Get the display nearest to the specified point
   * @param point - The point to check
   * @returns The display nearest to the point
   */
  getDisplayNearestPoint(point: Point): Display {
    const info = native.getDisplayNearestPoint(point.x, point.y);
    return toDisplay(info);
  },

  /**
   * Get the display that contains the specified point
   * @param point - The point to check
   * @returns The display containing the point, or the nearest display if none contain it
   */
  getDisplayMatching(rect: Rectangle): Display {
    // Find the display that has the most overlap with the given rectangle
    const displays = this.getAllDisplays();

    if (displays.length === 0) {
      throw new Error('No displays available');
    }

    if (displays.length === 1) {
      return displays[0];
    }

    // Calculate the center point of the rectangle
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;

    // Find the display containing the center point
    for (const display of displays) {
      const b = display.bounds;
      if (
        centerX >= b.x &&
        centerX < b.x + b.width &&
        centerY >= b.y &&
        centerY < b.y + b.height
      ) {
        return display;
      }
    }

    // Fall back to nearest point
    return this.getDisplayNearestPoint({ x: centerX, y: centerY });
  },

  /**
   * Get the current cursor screen position
   * @returns The cursor position
   */
  getCursorScreenPoint(): Point {
    assertRuntimeCapability('screen', 'screen.getCursorScreenPoint()');
    const point = native.getCursorScreenPoint();
    return { x: point.x, y: point.y };
  },

  /**
   * Get the menu bar height (macOS only, returns 0 on other platforms)
   * @returns The menu bar height in pixels
   */
  getMenuBarHeight(): number {
    if (process.platform === 'darwin') {
      // macOS menu bar is typically 25 pixels (was 22 before Big Sur)
      // We return the standard height; apps can query this at runtime
      // if needed. The exact height depends on display scaling.
      return 25;
    }
    return 0;
  },
};

// Export Display type
export type { Display as ScreenDisplay };
