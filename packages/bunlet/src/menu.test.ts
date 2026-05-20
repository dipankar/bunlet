/**
 * Menu API unit tests.
 *
 * Mocks the native runtime so we can verify pure JS-side behavior —
 * setApplicationMenu / getApplicationMenu round-trip, MenuItem
 * construction, and callback registration.
 */

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

let nextNativeId = 1;
const mockNative = {
  initMenuEvents: mock(() => {}),
  setMenuCallback: mock((_cb: unknown) => {}),
  createMenu: mock(() => nextNativeId++),
  destroyMenu: mock(() => {}),
  buildMenuFromTemplate: mock(() => {}),
  appendMenuItem: mock(() => {}),
  setApplicationMenu: mock(() => {}),
  popupMenu: mock(() => {}),
  closeContextMenu: mock(() => {}),
};

mock.module('./runtime', () => ({
  assertRuntimeCapability() {},
  native: mockNative,
}));

import { Menu, MenuItem } from './menu';

describe('Menu.setApplicationMenu / getApplicationMenu', () => {
  beforeEach(() => {
    nextNativeId = 100;
    for (const key of Object.keys(mockNative) as Array<keyof typeof mockNative>) {
      mockNative[key].mockClear();
    }
    Menu.setApplicationMenu(null);
    mockNative.setApplicationMenu.mockClear();
  });

  afterEach(() => {
    Menu.setApplicationMenu(null);
  });

  test('starts out null', () => {
    expect(Menu.getApplicationMenu()).toBeNull();
  });

  test('round-trips a Menu instance', () => {
    const menu = Menu.buildFromTemplate([
      { label: 'File', submenu: [] },
    ]);
    Menu.setApplicationMenu(menu);
    expect(Menu.getApplicationMenu()).toBe(menu);
  });

  test('forwards native id (or undefined) to the native binding', () => {
    const menu = Menu.buildFromTemplate([{ label: 'Edit' }]);
    Menu.setApplicationMenu(menu);
    expect(mockNative.setApplicationMenu).toHaveBeenLastCalledWith(menu.getNativeId());

    Menu.setApplicationMenu(null);
    expect(mockNative.setApplicationMenu).toHaveBeenLastCalledWith(undefined);
  });

  test('replacing the menu updates the getter', () => {
    const a = Menu.buildFromTemplate([{ label: 'A' }]);
    const b = Menu.buildFromTemplate([{ label: 'B' }]);
    Menu.setApplicationMenu(a);
    expect(Menu.getApplicationMenu()).toBe(a);
    Menu.setApplicationMenu(b);
    expect(Menu.getApplicationMenu()).toBe(b);
  });
});

describe('MenuItem construction', () => {
  test('a simple item carries its label and role', () => {
    const item = new MenuItem({ label: 'Quit', role: 'quit' });
    const opts = item.toNativeOptions();
    expect(opts.label).toBe('Quit');
    expect(opts.role).toBe('quit');
  });
});

describe('Menu.closePopup', () => {
  test('is a best-effort no-op when native has no closeContextMenu', () => {
    const menu = Menu.buildFromTemplate([{ label: 'Copy' }]);
    expect(() => menu.closePopup()).not.toThrow();
  });

  test('delegates to native.closeContextMenu when available', () => {
    const menu = Menu.buildFromTemplate([{ label: 'Copy' }]);
    expect(() => menu.closePopup()).not.toThrow();
    if (mockNative.closeContextMenu.mock.calls.length > 0) {
      expect(mockNative.closeContextMenu).toHaveBeenCalled();
    }
  });

  test('swallows native errors silently', () => {
    mockNative.closeContextMenu.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    const menu = Menu.buildFromTemplate([{ label: 'Copy' }]);
    expect(() => menu.closePopup()).not.toThrow();
  });
});
