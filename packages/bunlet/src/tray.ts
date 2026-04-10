/**
 * Tray API for Bunlet
 *
 * Provides cross-platform system tray icons.
 */

import { EventEmitter } from 'events';
import { native } from './runtime';
import type { Rectangle } from './types';
import type { Menu } from './menu';

/** Map of tray ID to Tray instance */
const trays = new Map<number, Tray>();

/** Whether tray events have been initialized */
let trayEventsInitialized = false;

/**
 * Initialize tray event handling
 */
function ensureTrayEventsInitialized(): void {
  if (trayEventsInitialized) return;
  trayEventsInitialized = true;

  native.initTrayEvents();
  native.setTrayCallback((event: { trayId: number; eventType: string; x: number; y: number }) => {
    const tray = trays.get(event.trayId);
    if (!tray) return;

    const bounds: Rectangle = {
      x: event.x,
      y: event.y,
      width: 0,
      height: 0,
    };

    switch (event.eventType) {
      case 'click':
        tray.emit('click', {}, bounds);
        break;
      case 'right-click':
        tray.emit('right-click', {}, bounds);
        break;
      case 'double-click':
        tray.emit('double-click', {}, bounds);
        break;
    }
  });
}

/**
 * System tray icon class
 */
export class Tray extends EventEmitter {
  private id: number;
  private destroyed = false;
  private contextMenu: Menu | null = null;

  /**
   * Create a new tray icon
   * @param image - Path to the tray icon image
   */
  constructor(image: string) {
    super();
    ensureTrayEventsInitialized();

    this.id = native.createTray(image);
    trays.set(this.id, this);
  }

  /**
   * Set the tray icon image
   * @param image - Path to the new icon image
   */
  setImage(image: string): void {
    if (this.destroyed) return;
    native.setTrayIcon(this.id, image);
  }

  /**
   * Set the tray tooltip
   * @param toolTip - Tooltip text
   */
  setToolTip(toolTip: string): void {
    if (this.destroyed) return;
    native.setTrayTooltip(this.id, toolTip);
  }

  /**
   * Set the tray title (macOS only)
   * @param title - Title text
   */
  setTitle(title: string): void {
    if (this.destroyed) return;
    native.setTrayTitle(this.id, title);
  }

  /**
   * Set the context menu for the tray
   * @param menu - Menu to show on right-click, or null to remove
   */
  setContextMenu(menu: Menu | null): void {
    if (this.destroyed) return;
    this.contextMenu = menu;

    if (menu) {
      native.setTrayMenu(this.id, menu.getNativeId());
    }
  }

  /**
   * Get the tray icon bounds
   */
  getBounds(): Rectangle {
    if (this.destroyed) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    const bounds = native.getTrayBounds(this.id);
    return {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    };
  }

  /**
   * Destroy the tray icon
   */
  destroy(): void {
    if (this.destroyed) return;

    native.destroyTray(this.id);
    trays.delete(this.id);
    this.destroyed = true;
  }

  /**
   * Check if the tray is destroyed
   */
  isDestroyed(): boolean {
    return this.destroyed;
  }

  // Event emitter type overloads
  on(event: 'click', listener: (event: unknown, bounds: Rectangle) => void): this;
  on(event: 'right-click', listener: (event: unknown, bounds: Rectangle) => void): this;
  on(event: 'double-click', listener: (event: unknown, bounds: Rectangle) => void): this;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string, listener: (...args: any[]) => void): this {
    return super.on(event, listener);
  }
}
