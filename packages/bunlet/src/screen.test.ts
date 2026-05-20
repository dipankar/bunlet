/**
 * screen API smoke tests.
 *
 * Mocks the native binding to verify the JS wrapper shape. The
 * primeScreenCache path is exercised indirectly via app.ts; this file
 * just covers the public surface of `screen` doesn't regress.
 */

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

const mockDisplay = {
  id: 0,
  name: 'Test Display',
  x: 0,
  y: 0,
  width: 1920,
  height: 1080,
  work_area_x: 0,
  work_area_y: 25,
  work_area_width: 1920,
  work_area_height: 1055,
  scale_factor: 2,
  is_primary: true,
};

const mockNative = {
  getPrimaryDisplay: mock(() => mockDisplay),
  getAllDisplays: mock(() => [mockDisplay]),
  getDisplayNearestPoint: mock((_x: number, _y: number) => mockDisplay),
  primeScreenCache: mock(() => {}),
};

mock.module('./runtime', () => ({
  assertRuntimeCapability() {},
  native: mockNative,
}));

import { screen } from './screen';

describe('screen', () => {
  beforeEach(() => {
    for (const k of Object.keys(mockNative) as Array<keyof typeof mockNative>) {
      mockNative[k].mockClear();
    }
  });

  afterEach(() => {});

  test('getPrimaryDisplay returns a structured Display', () => {
    const d = screen.getPrimaryDisplay();
    expect(d.id).toBe(0);
    expect(d.bounds).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
    expect(d.workArea).toEqual({ x: 0, y: 25, width: 1920, height: 1055 });
    expect(d.scaleFactor).toBe(2);
    expect(d.primary).toBe(true);
  });

  test('getAllDisplays returns an array', () => {
    const all = screen.getAllDisplays();
    expect(Array.isArray(all)).toBe(true);
    expect(all.length).toBeGreaterThan(0);
  });

  test('getDisplayNearestPoint forwards the point coords', () => {
    const d = screen.getDisplayNearestPoint({ x: 500, y: 500 });
    expect(d.id).toBe(0);
    expect(mockNative.getDisplayNearestPoint).toHaveBeenCalledWith(500, 500);
  });
});
