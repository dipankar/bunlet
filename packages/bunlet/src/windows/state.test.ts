import { describe, expect, test } from 'bun:test';
import { BrowserWindowState, WebContentsState } from './state';

describe('window state separation', () => {
  test('tracks browser window lifecycle state independently', () => {
    const state = new BrowserWindowState('Editor');

    expect(state.getTitle()).toBe('Editor');
    expect(state.isDestroyed()).toBe(false);

    state.setTitle('Notes');
    state.markDestroyed();

    expect(state.getTitle()).toBe('Notes');
    expect(state.isDestroyed()).toBe(true);
  });

  test('tracks web contents navigation history independently', () => {
    const state = new WebContentsState('Editor');

    state.recordNavigation('https://example.com');
    state.recordNavigation('https://example.com/docs');

    expect(state.getURL()).toBe('https://example.com/docs');
    expect(state.canGoBack()).toBe(true);
    expect(state.canGoForward()).toBe(false);

    state.recordGoBack();

    expect(state.getURL()).toBe('https://example.com');
    expect(state.canGoBack()).toBe(false);
    expect(state.canGoForward()).toBe(true);
  });

  test('uses empty URL for navigation targets that are not yet observable', () => {
    const state = new WebContentsState('Editor');

    state.recordNavigation('https://example.com');
    state.recordUnknownNavigation();

    expect(state.getURL()).toBe('');
    expect(state.canGoBack()).toBe(true);
  });
});
