/**
 * Menu API for Bunlet
 *
 * Provides cross-platform application and context menus.
 */

import { native } from './runtime';
import type { BrowserWindow } from './browser-window';

/** Callback ID counter */
let callbackIdCounter = 1;

/** Map of callback ID to function */
const callbacks = new Map<number, () => void>();

/** Whether menu events have been initialized */
let menuEventsInitialized = false;

/**
 * Initialize menu event handling
 */
function ensureMenuEventsInitialized(): void {
  if (menuEventsInitialized) return;
  menuEventsInitialized = true;

  native.initMenuEvents();
  native.setMenuCallback((event: { menuId: number; itemId: string; callbackId: number }) => {
    const callback = callbacks.get(event.callbackId);
    if (callback) {
      try {
        callback();
      } catch (error) {
        console.error('Error in menu item callback:', error);
      }
    }
  });
}

/**
 * Predefined menu item roles
 */
export type MenuItemRole =
  | 'undo'
  | 'redo'
  | 'cut'
  | 'copy'
  | 'paste'
  | 'delete'
  | 'selectAll'
  | 'reload'
  | 'forceReload'
  | 'toggleDevTools'
  | 'resetZoom'
  | 'zoomIn'
  | 'zoomOut'
  | 'togglefullscreen'
  | 'window'
  | 'minimize'
  | 'close'
  | 'closeWindow'
  | 'help'
  | 'about'
  | 'services'
  | 'hide'
  | 'hideOthers'
  | 'unhide'
  | 'showAll'
  | 'quit'
  | 'startSpeaking'
  | 'stopSpeaking'
  | 'appMenu'
  | 'fileMenu'
  | 'editMenu'
  | 'viewMenu'
  | 'windowMenu'
  | 'fullscreen';

/**
 * Options for creating a menu item
 */
export interface MenuItemOptions {
  /** Predefined role for the menu item */
  role?: MenuItemRole;
  /** Type of menu item */
  type?: 'normal' | 'separator' | 'submenu' | 'checkbox' | 'radio';
  /** Menu item label */
  label?: string;
  /** Secondary label */
  sublabel?: string;
  /** Keyboard accelerator (e.g., "Ctrl+S", "Cmd+O") */
  accelerator?: string;
  /** Path to icon image */
  icon?: string;
  /** Whether the item is enabled */
  enabled?: boolean;
  /** Whether the item is visible */
  visible?: boolean;
  /** Whether the item is checked (for checkbox/radio) */
  checked?: boolean;
  /** Submenu items */
  submenu?: MenuItemOptions[] | Menu;
  /** Unique ID for the menu item */
  id?: string;
  /** Click handler */
  click?: (menuItem: MenuItem, window: BrowserWindow | null) => void;
}

/**
 * Options for popup menu
 */
export interface PopupOptions {
  /** Parent window */
  window?: BrowserWindow;
  /** X position */
  x?: number;
  /** Y position */
  y?: number;
}

/**
 * Menu item class
 */
export class MenuItem {
  readonly id: string;
  label: string;
  click?: (menuItem: MenuItem, window: BrowserWindow | null) => void;
  enabled: boolean;
  visible: boolean;
  checked: boolean;
  accelerator?: string;
  submenu?: Menu;
  type: 'normal' | 'separator' | 'submenu' | 'checkbox' | 'radio';
  role?: MenuItemRole;

  private callbackId?: number;

  constructor(options: MenuItemOptions) {
    this.id = options.id || `menu-item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.label = options.label || '';
    this.enabled = options.enabled ?? true;
    this.visible = options.visible ?? true;
    this.checked = options.checked ?? false;
    this.accelerator = options.accelerator;
    this.type = options.type || 'normal';
    this.role = options.role;

    if (options.click) {
      this.click = options.click;
      this.callbackId = callbackIdCounter++;
      callbacks.set(this.callbackId, () => {
        if (this.click) {
          this.click(this, null);
        }
      });
    }

    if (options.submenu) {
      if (options.submenu instanceof Menu) {
        this.submenu = options.submenu;
      } else {
        this.submenu = Menu.buildFromTemplate(options.submenu);
      }
      this.type = 'submenu';
    }
  }

  /**
   * Convert to native options format
   */
  toNativeOptions(): Record<string, unknown> {
    const options: Record<string, unknown> = {
      id: this.id,
      label: this.label,
      enabled: this.enabled,
      itemType: this.type,
      accelerator: this.accelerator,
      checked: this.checked,
      role: this.role,
      callbackId: this.callbackId,
    };

    if (this.submenu) {
      options.submenu = this.submenu.items.map((item) => item.toNativeOptions());
    }

    return options;
  }
}

/**
 * Menu class for application and context menus
 */
export class Menu {
  private nativeId: number;
  readonly items: MenuItem[] = [];

  constructor() {
    ensureMenuEventsInitialized();
    this.nativeId = native.createMenu();
  }

  /**
   * Build a menu from a template
   * @param template - Array of menu item options
   */
  static buildFromTemplate(template: MenuItemOptions[]): Menu {
    const menu = new Menu();

    for (const itemOptions of template) {
      const item = new MenuItem(itemOptions);
      menu.append(item);
    }

    return menu;
  }

  /**
   * Set the application menu
   * @param menu - Menu to set as application menu, or null to remove
   */
  static setApplicationMenu(menu: Menu | null): void {
    ensureMenuEventsInitialized();
    native.setApplicationMenu(menu?.nativeId ?? undefined);
  }

  /**
   * Get the current application menu
   */
  static getApplicationMenu(): Menu | null {
    throw new Error(
      `[bunlet] Menu.getApplicationMenu() is not yet supported. ` +
      `Application menu reconstruction from native ID is not implemented.`
    );
  }

  /**
   * Append a menu item
   * @param menuItem - Menu item to append
   */
  append(menuItem: MenuItem): void {
    this.items.push(menuItem);
    native.appendMenuItem(this.nativeId, menuItem.toNativeOptions());
  }

  /**
   * Insert a menu item at a position
   * @param pos - Position to insert at
   * @param menuItem - Menu item to insert
   */
  insert(pos: number, menuItem: MenuItem): void {
    this.items.splice(pos, 0, menuItem);
    // Rebuild menu (native doesn't support insert)
    native.destroyMenu(this.nativeId);
    this.nativeId = native.createMenu();
    const template = this.items.map((item) => item.toNativeOptions());
    native.buildMenuFromTemplate(this.nativeId, template);
  }

  /**
   * Show as a popup/context menu
   * @param options - Popup options
   */
  popup(options?: PopupOptions): void {
    const windowId = options?.window?.id ?? 0;
    const x = options?.x ?? 0;
    const y = options?.y ?? 0;
    native.popupMenu(this.nativeId, windowId, x, y);
  }

  /**
   * Close the popup menu
   * @param window - Window to close popup for
   */
  closePopup(_window?: BrowserWindow): void {
    throw new Error(
      `[bunlet] Menu.closePopup() is not yet supported. ` +
      `Context menu dismissal is not implemented.`
    );
  }

  /**
   * Get the native menu ID
   */
  getNativeId(): number {
    return this.nativeId;
  }

  /**
   * Destroy the menu
   */
  destroy(): void {
    native.destroyMenu(this.nativeId);
  }
}
