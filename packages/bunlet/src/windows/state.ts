/**
 * Internal state holders for window and web contents abstractions.
 *
 * These let BrowserWindow and WebContents evolve independently even while
 * native-originated event sync is still being built out.
 */
import type { Rectangle } from '../types';

export class BrowserWindowState {
  private title: string;
  private destroyed = false;
  private bounds: Rectangle | undefined;
  private focused = false;
  private minimized = false;
  private maximized = false;
  private fullscreen = false;
  private visible = true;

  constructor(initialTitle: string) {
    this.title = initialTitle;
  }

  getTitle(): string {
    return this.title;
  }

  setTitle(title: string): void {
    this.title = title;
  }

  isDestroyed(): boolean {
    return this.destroyed;
  }

  markDestroyed(): void {
    this.destroyed = true;
  }

  getBounds(): Rectangle | undefined {
    return this.bounds;
  }

  updateBounds(bounds: Rectangle): void {
    this.bounds = bounds;
  }

  isFocused(): boolean {
    return this.focused;
  }

  setFocused(value: boolean): void {
    this.focused = value;
  }

  isMinimized(): boolean {
    return this.minimized;
  }

  setMinimized(value: boolean): void {
    this.minimized = value;
  }

  isMaximized(): boolean {
    return this.maximized;
  }

  setMaximized(value: boolean): void {
    this.maximized = value;
  }

  isFullscreen(): boolean {
    return this.fullscreen;
  }

  setFullscreen(value: boolean): void {
    this.fullscreen = value;
  }

  isVisible(): boolean {
    return this.visible;
  }

  setVisible(value: boolean): void {
    this.visible = value;
  }
}

export class WebContentsState {
  private readonly history: string[] = [];
  private historyIndex = -1;
  private title: string;

  constructor(initialTitle: string) {
    this.title = initialTitle;
  }

  recordNavigation(url: string): void {
    if (this.historyIndex < this.history.length - 1) {
      this.history.splice(this.historyIndex + 1);
    }

    this.history.push(url);
    this.historyIndex = this.history.length - 1;
  }

  recordUnknownNavigation(): void {
    this.recordNavigation('');
  }

  recordGoBack(): void {
    if (this.canGoBack()) {
      this.historyIndex -= 1;
    }
  }

  recordGoForward(): void {
    if (this.canGoForward()) {
      this.historyIndex += 1;
    }
  }

  getURL(): string {
    return this.history[this.historyIndex] ?? '';
  }

  canGoBack(): boolean {
    return this.historyIndex > 0;
  }

  canGoForward(): boolean {
    return this.historyIndex >= 0 && this.historyIndex < this.history.length - 1;
  }

  getTitle(): string {
    return this.title;
  }

  setTitle(title: string): void {
    this.title = title;
  }
}
