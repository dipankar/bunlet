/**
 * Internal state holders for window and web contents abstractions.
 *
 * These let BrowserWindow and WebContents evolve independently even while
 * native-originated event sync is still being built out.
 */
export class BrowserWindowState {
  private title: string;
  private destroyed = false;

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
