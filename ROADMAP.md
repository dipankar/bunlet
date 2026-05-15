# Bunlet Roadmap

This document outlines the development roadmap for Bunlet, from initial foundation to stable v1.0 release.

## Overview

| Phase | Version | Focus |
|-------|---------|-------|
| 1 | v0.1.0 | Core Foundation |
| 2 | v0.2.0 | Native APIs |
| 3 | v0.3.0 | Developer Experience |
| 4 | v0.4.0 | Packaging |
| 5 | v0.5.0 | Distribution |
| 6 | v0.6.0 | CEF Mode |
| 7 | v1.0.0 | Optimization & Polish |

---

## Phase 1: Core Foundation (v0.1.0)

**Goal**: Establish the fundamental runtime and window management capabilities.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Bunlet Application                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Main Process (Bun)                     │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │   │
│  │  │   App.ts    │  │BrowserWindow│  │   IPC Router    │   │   │
│  │  │  Lifecycle  │  │   Manager   │  │  (JSON-RPC 2.0) │   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘   │   │
│  │         │                │                   │            │   │
│  │         └────────────────┼───────────────────┘            │   │
│  │                          ▼                                │   │
│  │  ┌──────────────────────────────────────────────────┐    │   │
│  │  │              Native Bindings (NAPI-RS)            │    │   │
│  │  │  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  │    │   │
│  │  │  │  tao   │  │  wry   │  │  IPC   │  │ Events │  │    │   │
│  │  │  │Windows │  │WebView │  │ Bridge │  │  Loop  │  │    │   │
│  │  │  └────────┘  └────────┘  └────────┘  └────────┘  │    │   │
│  │  └──────────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│              ┌───────────────┼───────────────┐                  │
│              ▼               ▼               ▼                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Window 1   │  │   Window 2   │  │   Window N   │          │
│  │  ┌────────┐  │  │  ┌────────┐  │  │  ┌────────┐  │          │
│  │  │WebView │  │  │  │WebView │  │  │  │WebView │  │          │
│  │  │Renderer│  │  │  │Renderer│  │  │  │Renderer│  │          │
│  │  └────────┘  │  │  └────────┘  │  │  └────────┘  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

### Native Bindings (`bunlet-native`)

#### Project Structure

```
bunlet-native/
├── Cargo.toml
├── build.rs                    # NAPI build configuration
├── src/
│   ├── lib.rs                  # NAPI module exports
│   ├── app.rs                  # Application lifecycle management
│   ├── window.rs               # Window creation and management (tao)
│   ├── webview.rs              # WebView rendering (wry)
│   ├── ipc.rs                  # IPC message bridge
│   ├── event_loop.rs           # Platform event loop integration
│   └── platform/
│       ├── mod.rs
│       ├── macos.rs            # macOS-specific implementations
│       ├── windows.rs          # Windows-specific implementations
│       └── linux.rs            # Linux-specific implementations
├── npm/
│   ├── darwin-arm64/
│   │   └── package.json
│   ├── darwin-x64/
│   │   └── package.json
│   ├── win32-x64-msvc/
│   │   └── package.json
│   └── linux-x64-gnu/
│       └── package.json
└── index.js                    # Platform binary loader
```

#### Dependencies (Cargo.toml)

```toml
[dependencies]
napi = { version = "2", features = ["async", "serde-json"] }
napi-derive = "2"
tao = "0.28"                    # Window management
wry = "0.39"                    # WebView rendering
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["rt-multi-thread", "sync"] }
parking_lot = "0.12"            # Fast synchronization primitives
once_cell = "1"                 # Lazy static initialization

[target.'cfg(target_os = "macos")'.dependencies]
cocoa = "0.25"
objc = "0.2"

[target.'cfg(target_os = "windows")'.dependencies]
windows = { version = "0.54", features = ["Win32_UI_WindowsAndMessaging"] }

[target.'cfg(target_os = "linux")'.dependencies]
gtk = "0.18"
```

#### Key Interfaces (Rust)

```rust
// lib.rs - NAPI exports
#[napi]
pub struct NativeApp {
    event_loop: Option<EventLoop<UserEvent>>,
    windows: HashMap<u32, NativeWindow>,
}

#[napi]
impl NativeApp {
    #[napi(constructor)]
    pub fn new() -> Self;

    #[napi]
    pub fn run(&mut self) -> Result<()>;

    #[napi]
    pub fn quit(&self);

    #[napi]
    pub fn create_window(&mut self, options: WindowOptions) -> Result<u32>;
}

#[napi(object)]
pub struct WindowOptions {
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub title: Option<String>,
    pub resizable: Option<bool>,
    pub decorations: Option<bool>,
    pub transparent: Option<bool>,
    pub preload: Option<String>,
}

#[napi]
pub struct NativeWindow {
    window: Window,
    webview: WebView,
    id: u32,
}

#[napi]
impl NativeWindow {
    #[napi]
    pub fn load_url(&self, url: String) -> Result<()>;

    #[napi]
    pub fn load_file(&self, path: String) -> Result<()>;

    #[napi]
    pub fn show(&self);

    #[napi]
    pub fn hide(&self);

    #[napi]
    pub fn close(&self);

    #[napi]
    pub fn send_ipc(&self, channel: String, payload: String) -> Result<()>;
}
```

### TypeScript Core (`bunlet`)

#### Project Structure

```
packages/bunlet/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                # Public API exports
│   ├── app.ts                  # App singleton class
│   ├── browser-window.ts       # BrowserWindow class
│   ├── web-contents.ts         # WebContents class
│   ├── ipc/
│   │   ├── index.ts            # IPC exports
│   │   ├── main.ts             # Main process IPC (app.handle)
│   │   ├── renderer.ts         # Renderer IPC (ipcRenderer)
│   │   ├── protocol.ts         # JSON-RPC 2.0 protocol
│   │   └── types.ts            # IPC type definitions
│   ├── context-bridge.ts       # contextBridge implementation
│   ├── preload/
│   │   ├── index.ts            # Preload script helpers
│   │   └── sandbox.ts          # Sandboxed preload environment
│   └── native/
│       ├── bindings.ts         # Native addon loader
│       └── types.ts            # Native binding types
└── scripts/
    └── postinstall.js          # Platform binary installation
```

#### Key Interfaces (TypeScript)

```typescript
// app.ts
import { EventEmitter } from 'events';
import { z } from 'zod';

export class App extends EventEmitter {
  private static instance: App;
  private handlers: Map<string, IPCHandler>;
  private windows: Map<number, BrowserWindow>;

  static getInstance(): App;

  // Lifecycle
  whenReady(): Promise<void>;
  quit(): void;
  exit(exitCode?: number): void;
  relaunch(options?: RelaunchOptions): void;

  // Paths
  getPath(name: PathName): string;
  setPath(name: PathName, path: string): void;
  getAppPath(): string;

  // App info
  getName(): string;
  getVersion(): string;
  getLocale(): string;

  // IPC
  handle<T extends z.ZodType>(
    channel: string,
    schema: T,
    handler: (args: z.infer<T>, context: IPCContext) => Promise<unknown>
  ): void;

  removeHandler(channel: string): void;
}

// browser-window.ts
export interface BrowserWindowOptions {
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  center?: boolean;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  resizable?: boolean;
  movable?: boolean;
  minimizable?: boolean;
  maximizable?: boolean;
  closable?: boolean;
  title?: string;
  show?: boolean;
  frame?: boolean;
  transparent?: boolean;
  backgroundColor?: string;
  parent?: BrowserWindow;
  modal?: boolean;
  alwaysOnTop?: boolean;
  fullscreen?: boolean;
  webPreferences?: WebPreferences;
}

export interface WebPreferences {
  preload?: string;
  devTools?: boolean;
  contextIsolation?: boolean;
  sandbox?: boolean;
  webSecurity?: boolean;
}

export class BrowserWindow extends EventEmitter {
  readonly id: number;
  readonly webContents: WebContents;

  constructor(options?: BrowserWindowOptions);

  // Static methods
  static getAllWindows(): BrowserWindow[];
  static getFocusedWindow(): BrowserWindow | null;
  static fromId(id: number): BrowserWindow | null;

  // Content
  loadURL(url: string): Promise<void>;
  loadFile(filePath: string): Promise<void>;
  reload(): void;

  // Visibility
  show(): void;
  hide(): void;
  focus(): void;
  blur(): void;

  // State
  isVisible(): boolean;
  isFocused(): boolean;
  isMaximized(): boolean;
  isMinimized(): boolean;
  isFullScreen(): boolean;
  isDestroyed(): boolean;

  // Window actions
  maximize(): void;
  unmaximize(): void;
  minimize(): void;
  restore(): void;
  setFullScreen(flag: boolean): void;
  close(): void;
  destroy(): void;

  // Geometry
  getBounds(): Rectangle;
  setBounds(bounds: Partial<Rectangle>, animate?: boolean): void;
  setSize(width: number, height: number, animate?: boolean): void;
  setPosition(x: number, y: number, animate?: boolean): void;
  center(): void;

  // Properties
  setTitle(title: string): void;
  getTitle(): string;
  setAlwaysOnTop(flag: boolean): void;

  // IPC
  send(channel: string, ...args: unknown[]): void;
}

// ipc/protocol.ts
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string;
  method: string;
  params: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string;
  result?: unknown;
  error?: JsonRpcError;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

// ipc/renderer.ts (for preload)
export const ipcRenderer = {
  invoke(channel: string, args?: unknown): Promise<unknown>;
  send(channel: string, ...args: unknown[]): void;
  on(channel: string, listener: (event: IpcEvent, ...args: unknown[]) => void): void;
  off(channel: string, listener: Function): void;
  once(channel: string, listener: (event: IpcEvent, ...args: unknown[]) => void): void;
};

// context-bridge.ts
export const contextBridge = {
  exposeInMainWorld(apiKey: string, api: Record<string, unknown>): void;
};
```

### CLI (`bunlet-cli`)

#### Project Structure

```
packages/bunlet-cli/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                # CLI entry point
│   ├── cli.ts                  # Command parser (using commander)
│   ├── commands/
│   │   ├── create.ts           # bunlet create
│   │   ├── dev.ts              # bunlet dev
│   │   ├── build.ts            # bunlet build
│   │   └── package.ts          # bunlet package
│   ├── config/
│   │   ├── loader.ts           # Config file loader
│   │   ├── schema.ts           # Config validation schema
│   │   └── defaults.ts         # Default configuration
│   └── templates/
│       ├── default/
│       │   ├── main.ts
│       │   ├── preload.ts
│       │   ├── index.html
│       │   ├── renderer.ts
│       │   ├── bunlet.config.ts
│       │   └── package.json
│       ├── react/
│       │   └── ...
│       ├── vue/
│       │   └── ...
│       └── svelte/
│           └── ...
└── bin/
    └── bunlet.js               # Executable entry
```

#### CLI Commands

```typescript
// cli.ts
import { Command } from 'commander';

const program = new Command();

program
  .name('bunlet')
  .description('Build cross-platform desktop apps with Bun')
  .version('0.1.0');

program
  .command('create <app-name>')
  .description('Create a new Bunlet application')
  .option('-t, --template <template>', 'Project template', 'default')
  .option('--typescript', 'Use TypeScript (default)', true)
  .option('--no-git', 'Skip git initialization')
  .action(createCommand);

program
  .command('dev')
  .description('Start development server')
  .option('-p, --port <port>', 'Dev server port', '5173')
  .option('--no-hmr', 'Disable hot module replacement')
  .action(devCommand);

program
  .command('build')
  .description('Build for production')
  .option('--bytecode', 'Compile to bytecode')
  .option('--analyze', 'Analyze bundle size')
  .action(buildCommand);

program
  .command('package')
  .description('Package application for distribution')
  .option('--mac', 'Build for macOS')
  .option('--win', 'Build for Windows')
  .option('--linux', 'Build for Linux')
  .option('--format <format>', 'Package format (dmg, msi, appimage, etc.)')
  .action(packageCommand);
```

### Multi-Window Architecture

Bunlet supports multiple windows with independent webviews and window-specific IPC:

```typescript
// Multi-window example
import { app, BrowserWindow } from '@bunlet/core';

let mainWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;

app.whenReady().then(() => {
  // Main window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: { preload: './preload.ts' }
  });
  mainWindow.loadFile('index.html');

  // Settings window (child of main)
  settingsWindow = new BrowserWindow({
    width: 600,
    height: 400,
    parent: mainWindow,
    modal: true,
    show: false,
  });
});

// Get all windows
const allWindows = BrowserWindow.getAllWindows();

// Broadcast to all windows
function broadcast(channel: string, data: unknown) {
  BrowserWindow.getAllWindows().forEach(win => {
    win.send(channel, data);
  });
}

// Window-specific IPC with context
app.handle('get-settings', z.object({}), async (_, context) => {
  // context.window is the calling window
  const bounds = context.window.getBounds();
  return { bounds };
});
```

### Prebuilt Binaries

Platform-specific native addon builds:

| Platform | Architecture | Package |
|----------|--------------|---------|
| macOS | arm64 | `@bunlet/native-darwin-arm64` |
| macOS | x64 | `@bunlet/native-darwin-x64` |
| Windows | x64 | `@bunlet/native-win32-x64-msvc` |
| Linux | x64 | `@bunlet/native-linux-x64-gnu` |

### Checklist

- [ ] Set up Rust project with NAPI-RS
- [ ] Integrate `tao` for cross-platform window management
- [ ] Integrate `wry` for WebView rendering
- [ ] Implement window creation, show/hide, sizing
- [ ] Implement content loading (URL, HTML, file)
- [ ] Prebuilt binaries for all platforms
- [ ] `App` class with lifecycle events
- [ ] `BrowserWindow` class with full API
- [ ] Basic IPC router with `app.handle()`
- [ ] `bunlet create` command with templates
- [ ] `bunlet dev` command

### Success Criteria

- [ ] Create and display a window on all three platforms
- [ ] Load local HTML file and remote URL
- [ ] IPC round-trip between main and renderer works
- [ ] Hot reload of renderer content during development
- [ ] Multi-window support with parent/child relationships

---

## Phase 2: Native APIs (v0.2.0)

**Goal**: Implement essential native platform APIs.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Native APIs Layer                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Dialog    │  │    Menu     │  │    Tray     │              │
│  │    (rfd)    │  │   (muda)    │  │ (tray-icon) │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │Notification │  │  Clipboard  │  │    Shell    │              │
│  │  (native)   │  │  (arboard)  │  │  (native)   │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐                               │
│  │  Shortcuts  │  │  App Paths  │                               │
│  │  (native)   │  │ (dirs-next) │                               │
│  └─────────────┘  └─────────────┘                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Platform Implementation Matrix

| API | Windows | macOS | Linux | Rust Crate |
|-----|---------|-------|-------|------------|
| Dialog | Common Dialogs | NSOpenPanel/NSSavePanel | GTK FileChooser | `rfd` |
| Menu | HMENU | NSMenu | GTK Menu | `muda` |
| Tray | Shell_NotifyIcon | NSStatusItem | libappindicator | `tray-icon` |
| Notification | WinRT Toast | NSUserNotification | libnotify | `notify-rust` |
| Clipboard | Clipboard API | NSPasteboard | GTK Clipboard | `arboard` |
| Shell | ShellExecute | NSWorkspace | xdg-open | native |
| Shortcuts | RegisterHotKey | CGEventTap | X11/XCB | `global-hotkey` |
| Paths | Known Folders | NSSearchPath | XDG dirs | `dirs-next` |

### Dependencies (Additional)

```toml
[dependencies]
rfd = "0.14"                    # File dialogs
muda = "0.13"                   # Menu system
tray-icon = "0.14"              # System tray
notify-rust = "4"               # Desktop notifications
arboard = "3"                   # Clipboard
global-hotkey = "0.5"           # Global shortcuts
dirs-next = "2"                 # Standard directories
```

### Dialog API

#### TypeScript Interface

```typescript
// dialog.ts
export interface OpenDialogOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: FileFilter[];
  properties?: Array<
    'openFile' | 'openDirectory' | 'multiSelections' |
    'showHiddenFiles' | 'createDirectory' | 'promptToCreate'
  >;
}

export interface SaveDialogOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: FileFilter[];
  properties?: Array<'showHiddenFiles' | 'createDirectory'>;
}

export interface MessageBoxOptions {
  type?: 'none' | 'info' | 'error' | 'question' | 'warning';
  buttons?: string[];
  defaultId?: number;
  title?: string;
  message: string;
  detail?: string;
  checkboxLabel?: string;
  checkboxChecked?: boolean;
  cancelId?: number;
  noLink?: boolean;
}

export interface FileFilter {
  name: string;
  extensions: string[];
}

export const dialog = {
  showOpenDialog(
    window: BrowserWindow | null,
    options: OpenDialogOptions
  ): Promise<OpenDialogReturnValue>;

  showSaveDialog(
    window: BrowserWindow | null,
    options: SaveDialogOptions
  ): Promise<SaveDialogReturnValue>;

  showMessageBox(
    window: BrowserWindow | null,
    options: MessageBoxOptions
  ): Promise<MessageBoxReturnValue>;

  showErrorBox(title: string, content: string): void;
};
```

### Menu API

#### TypeScript Interface

```typescript
// menu.ts
export interface MenuItemOptions {
  role?: MenuItemRole;
  type?: 'normal' | 'separator' | 'submenu' | 'checkbox' | 'radio';
  label?: string;
  sublabel?: string;
  accelerator?: string;
  icon?: string;
  enabled?: boolean;
  visible?: boolean;
  checked?: boolean;
  submenu?: MenuItemOptions[] | Menu;
  id?: string;
  click?: (menuItem: MenuItem, window: BrowserWindow | null) => void;
}

export type MenuItemRole =
  | 'undo' | 'redo' | 'cut' | 'copy' | 'paste' | 'delete'
  | 'selectAll' | 'reload' | 'forceReload' | 'toggleDevTools'
  | 'resetZoom' | 'zoomIn' | 'zoomOut' | 'togglefullscreen'
  | 'window' | 'minimize' | 'close' | 'help' | 'about'
  | 'services' | 'hide' | 'hideOthers' | 'unhide' | 'quit'
  | 'startSpeaking' | 'stopSpeaking' | 'appMenu' | 'fileMenu'
  | 'editMenu' | 'viewMenu' | 'windowMenu';

export class Menu {
  static buildFromTemplate(template: MenuItemOptions[]): Menu;
  static setApplicationMenu(menu: Menu | null): void;
  static getApplicationMenu(): Menu | null;

  constructor();
  popup(options?: PopupOptions): void;
  closePopup(window?: BrowserWindow): void;
  append(menuItem: MenuItem): void;
  insert(pos: number, menuItem: MenuItem): void;
  items: MenuItem[];
}

export class MenuItem {
  constructor(options: MenuItemOptions);
  id: string;
  label: string;
  click: Function;
  enabled: boolean;
  visible: boolean;
  checked: boolean;
  accelerator: string | undefined;
  submenu: Menu | undefined;
}
```

### Tray API

#### TypeScript Interface

```typescript
// tray.ts
export class Tray extends EventEmitter {
  constructor(image: string);

  setImage(image: string): void;
  setToolTip(toolTip: string): void;
  setTitle(title: string): void;  // macOS only
  setContextMenu(menu: Menu | null): void;

  getBounds(): Rectangle;

  destroy(): void;
  isDestroyed(): boolean;

  // Events
  on(event: 'click', listener: (event: Event, bounds: Rectangle) => void): this;
  on(event: 'right-click', listener: (event: Event, bounds: Rectangle) => void): this;
  on(event: 'double-click', listener: (event: Event, bounds: Rectangle) => void): this;
}
```

### Notification API

```typescript
// notification.ts
export interface NotificationOptions {
  title: string;
  body?: string;
  subtitle?: string;  // macOS
  icon?: string;
  silent?: boolean;
  urgency?: 'low' | 'normal' | 'critical';  // Linux
  timeoutType?: 'default' | 'never';
  actions?: NotificationAction[];
  closeButtonText?: string;
  hasReply?: boolean;  // macOS
  replyPlaceholder?: string;  // macOS
}

export interface NotificationAction {
  type: 'button';
  text: string;
}

export class Notification extends EventEmitter {
  constructor(options: NotificationOptions);

  static isSupported(): boolean;

  show(): void;
  close(): void;

  on(event: 'show', listener: () => void): this;
  on(event: 'click', listener: () => void): this;
  on(event: 'close', listener: () => void): this;
  on(event: 'reply', listener: (event: Event, reply: string) => void): this;
  on(event: 'action', listener: (event: Event, index: number) => void): this;
}
```

### Clipboard API

```typescript
// clipboard.ts
export const clipboard = {
  readText(type?: 'selection' | 'clipboard'): string;
  writeText(text: string, type?: 'selection' | 'clipboard'): void;

  readHTML(type?: 'selection' | 'clipboard'): string;
  writeHTML(markup: string, type?: 'selection' | 'clipboard'): void;

  readImage(type?: 'selection' | 'clipboard'): NativeImage;
  writeImage(image: NativeImage, type?: 'selection' | 'clipboard'): void;

  readFilePaths(): string[];

  availableFormats(type?: 'selection' | 'clipboard'): string[];
  has(format: string, type?: 'selection' | 'clipboard'): boolean;

  clear(type?: 'selection' | 'clipboard'): void;
};
```

### Shell API

```typescript
// shell.ts
export const shell = {
  openExternal(url: string, options?: OpenExternalOptions): Promise<void>;
  openPath(path: string): Promise<string>;
  showItemInFolder(fullPath: string): void;
  trashItem(path: string): Promise<void>;
  beep(): void;
};
```

### Global Shortcuts API

```typescript
// global-shortcut.ts
export const globalShortcut = {
  register(accelerator: string, callback: () => void): boolean;
  registerAll(accelerators: string[], callback: () => void): void;
  unregister(accelerator: string): void;
  unregisterAll(): void;
  isRegistered(accelerator: string): boolean;
};
```

### Checklist

- [ ] Dialog API (open, save, message, error)
- [ ] Menu API with application menu and context menus
- [ ] Tray API with icons and context menu
- [ ] Notification API with actions
- [ ] Clipboard API (text, HTML, image)
- [ ] Shell API (openExternal, openPath, showItemInFolder)
- [ ] Global Shortcuts with accelerator strings
- [ ] App paths (home, appData, userData, etc.)

### Success Criteria

- [ ] File dialogs work on all platforms
- [ ] Application menu appears correctly
- [ ] System tray with icon and menu
- [ ] Desktop notifications with click handling
- [ ] Clipboard read/write operations
- [ ] Global keyboard shortcuts

---

## Phase 3: Developer Experience (v0.3.0)

**Goal**: Create a smooth, fast development workflow.

### HMR Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                      Development Mode                             │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                    Dev Server (Bun.serve)                   │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │  │
│  │  │ File Watcher │  │  HMR Server  │  │  Static Server   │  │  │
│  │  │  (chokidar)  │  │  (WebSocket) │  │   (HTTP/HTTPS)   │  │  │
│  │  └──────┬───────┘  └──────┬───────┘  └──────────────────┘  │  │
│  │         │                 │                                 │  │
│  │         │    ┌────────────┘                                 │  │
│  │         │    │                                              │  │
│  │         ▼    ▼                                              │  │
│  │  ┌──────────────────────────────────────────────────────┐  │  │
│  │  │                   Module Graph                        │  │  │
│  │  │  - Track dependencies                                 │  │  │
│  │  │  - Invalidate on change                              │  │  │
│  │  │  - Generate HMR updates                              │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────┘  │
│                              │                                    │
│              ┌───────────────┼───────────────┐                   │
│              ▼               ▼               ▼                   │
│  ┌──────────────────┐ ┌──────────────┐ ┌──────────────────┐     │
│  │   Main Process   │ │   Preload    │ │    Renderer      │     │
│  │  (Auto-restart)  │ │   (Reload)   │ │  (HMR Updates)   │     │
│  └──────────────────┘ └──────────────┘ └──────────────────┘     │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### HMR Implementation

```typescript
// dev-server.ts
export interface DevServerOptions {
  port: number;
  hmr: boolean;
  open: boolean;
}

export class DevServer {
  private wss: WebSocketServer;
  private watcher: FSWatcher;
  private moduleGraph: ModuleGraph;

  constructor(options: DevServerOptions);

  start(): Promise<void>;
  stop(): Promise<void>;

  // Send HMR update to all connected clients
  private sendUpdate(update: HMRUpdate): void;

  // Handle file change
  private handleFileChange(path: string): void;
}

// HMR protocol
export interface HMRUpdate {
  type: 'update' | 'full-reload' | 'error';
  timestamp: number;
  updates?: ModuleUpdate[];
  error?: string;
}

export interface ModuleUpdate {
  type: 'js-update' | 'css-update';
  path: string;
  acceptedPath: string;
}

// Client-side HMR runtime (injected into renderer)
export const hmrClient = {
  connect(url: string): void;

  // Module accepts self-update
  accept(callback?: (newModule: unknown) => void): void;

  // Module accepts dependency update
  acceptDeps(deps: string[], callback: (modules: unknown[]) => void): void;

  // Dispose callback
  dispose(callback: (data: unknown) => void): void;

  // Invalidate and bubble up
  invalidate(): void;
};
```

### DevTools Integration

```typescript
// web-contents.ts (additions)
export class WebContents {
  // DevTools methods
  openDevTools(options?: DevToolsOptions): void;
  closeDevTools(): void;
  toggleDevTools(): void;
  isDevToolsOpened(): boolean;
  isDevToolsFocused(): boolean;

  // JavaScript execution
  executeJavaScript(code: string): Promise<unknown>;

  // Debugging
  debugger: Debugger;

  // Inspection
  inspectElement(x: number, y: number): void;
}

export interface DevToolsOptions {
  mode?: 'right' | 'bottom' | 'detach' | 'undocked';
  activate?: boolean;
}
```

### Error Overlay

```typescript
// error-overlay.ts
export interface ErrorOverlayOptions {
  error: Error;
  source?: string;
  line?: number;
  column?: number;
}

// Injected into renderer during dev mode
export function showErrorOverlay(options: ErrorOverlayOptions): void;
export function hideErrorOverlay(): void;
```

### Debug Logging

```typescript
// debug.ts
export function createDebug(namespace: string): DebugLogger;

export interface DebugLogger {
  (message: string, ...args: unknown[]): void;
  enabled: boolean;
  namespace: string;
  extend(subNamespace: string): DebugLogger;
}

// Usage: DEBUG=bunlet:* bunlet dev
// Namespaces:
// - bunlet:core
// - bunlet:ipc
// - bunlet:window
// - bunlet:native
// - bunlet:hmr
```

### Checklist

- [ ] WebSocket-based HMR server
- [ ] Renderer HMR with React Fast Refresh
- [ ] CSS hot reload
- [ ] Main process auto-restart
- [ ] Preload script watching
- [ ] Error overlay in renderer
- [ ] DevTools open/close/toggle
- [ ] Source map generation
- [ ] Debug namespace logging

### Success Criteria

- [ ] Sub-second hot reload for renderer changes
- [ ] Main process restarts on change without losing window state
- [ ] Error overlay shows compile errors
- [ ] DevTools accessible via keyboard shortcut
- [ ] Source maps work in DevTools

---

## Phase 4: Packaging (v0.4.0)

**Goal**: Bundle applications for distribution.

### Build Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Build Pipeline                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Source Files                                                        │
│  ├── main.ts                                                        │
│  ├── preload.ts                                                     │
│  └── renderer/                                                      │
│       ├── index.html                                                │
│       ├── index.tsx                                                 │
│       └── styles.css                                                │
│              │                                                       │
│              ▼                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    Bun.build()                                │   │
│  │  - Bundle main.ts → dist/main.js                             │   │
│  │  - Bundle preload.ts → dist/preload.js                       │   │
│  │  - Bundle renderer → dist/renderer/                          │   │
│  │  - Minify (terser)                                           │   │
│  │  - Tree shake                                                │   │
│  │  - Source maps                                               │   │
│  └──────────────────────────────────────────────────────────────┘   │
│              │                                                       │
│              ▼                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                bun build --compile                            │   │
│  │  - Embed Bun runtime                                         │   │
│  │  - Compile to bytecode (optional)                            │   │
│  │  - Single executable                                         │   │
│  └──────────────────────────────────────────────────────────────┘   │
│              │                                                       │
│              ▼                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                  Platform Bundle                              │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │   │
│  │  │    macOS     │  │   Windows    │  │    Linux     │        │   │
│  │  │   .app       │  │    .exe      │  │  executable  │        │   │
│  │  │  + native    │  │  + native    │  │  + native    │        │   │
│  │  │    addon     │  │    addon     │  │    addon     │        │   │
│  │  │  + resources │  │  + resources │  │  + resources │        │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘        │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Platform Bundle Structures

#### macOS (.app)

```
MyApp.app/
├── Contents/
│   ├── Info.plist
│   ├── MacOS/
│   │   └── MyApp                 # Main executable
│   ├── Frameworks/
│   │   └── bunlet.node           # Native addon
│   ├── Resources/
│   │   ├── app.icns              # App icon
│   │   ├── en.lproj/
│   │   │   └── InfoPlist.strings
│   │   └── app/
│   │       ├── main.js
│   │       ├── preload.js
│   │       └── renderer/
│   │           ├── index.html
│   │           └── assets/
│   └── _CodeSignature/
│       └── CodeResources
└── (Entitlements embedded)
```

#### Windows

```
MyApp/
├── MyApp.exe                     # Main executable
├── bunlet.node                   # Native addon
├── resources/
│   ├── app.ico
│   └── app/
│       ├── main.js
│       ├── preload.js
│       └── renderer/
└── WebView2Loader.dll            # WebView2 loader (if needed)
```

#### Linux

```
MyApp/
├── my-app                        # Main executable
├── bunlet.node                   # Native addon
├── resources/
│   ├── icon.png
│   └── app/
│       ├── main.js
│       ├── preload.js
│       └── renderer/
└── my-app.desktop                # Desktop entry
```

### Installer Formats

| Platform | Format | Tool | Description |
|----------|--------|------|-------------|
| macOS | DMG | `create-dmg` | Drag-and-drop installer |
| macOS | PKG | `pkgbuild` + `productbuild` | System installer |
| macOS | ZIP | native | For notarization |
| Windows | MSI | WiX Toolset | Windows Installer |
| Windows | NSIS | NSIS | Custom installer |
| Windows | Portable | none | Single .exe |
| Linux | AppImage | `appimagetool` | Universal package |
| Linux | DEB | `dpkg-deb` | Debian/Ubuntu |
| Linux | RPM | `rpmbuild` | RHEL/Fedora |
| Linux | Snap | `snapcraft` | Ubuntu Snap Store |
| Linux | Flatpak | `flatpak-builder` | Flathub |

### Code Signing

#### macOS

```typescript
// code-signing.ts
export interface MacOSSigningOptions {
  identity: string;              // "Developer ID Application: ..."
  entitlements?: string;         // Path to .entitlements file
  hardenedRuntime?: boolean;     // Default: true
  timestamp?: boolean;           // Default: true
}

export interface MacOSNotarizeOptions {
  appleId: string;
  password: string;              // App-specific password
  teamId: string;
  tool?: 'notarytool' | 'altool'; // Default: notarytool
}

// Default entitlements for Bunlet apps
export const defaultEntitlements = {
  'com.apple.security.cs.allow-unsigned-executable-memory': true,
  'com.apple.security.cs.allow-jit': true,
};
```

#### Windows

```typescript
// windows-signing.ts
export interface WindowsSigningOptions {
  certificateFile?: string;      // .pfx file
  certificatePassword?: string;
  certificateSubjectName?: string;
  certificateSha1?: string;
  timestampServer?: string;      // Default: http://timestamp.digicert.com
  signAlgorithm?: 'sha1' | 'sha256'; // Default: sha256
}
```

### Build Configuration

```typescript
// bunlet.config.ts
export interface BunletConfig {
  build?: {
    outDir?: string;             // Default: 'dist'
    minify?: boolean;            // Default: true for production
    sourcemap?: boolean | 'inline' | 'external';
    bytecode?: boolean;          // Compile to bytecode
    external?: string[];         // External dependencies
  };

  package?: {
    name?: string;
    version?: string;
    description?: string;
    author?: string;
    icon?: string;               // Source icon (will be converted)

    mac?: {
      category?: string;
      entitlements?: string;
      hardenedRuntime?: boolean;
      identity?: string;
      notarize?: boolean | NotarizeOptions;
      target?: ('dmg' | 'pkg' | 'zip')[];
    };

    win?: {
      icon?: string;
      target?: ('msi' | 'nsis' | 'portable')[];
      sign?: WindowsSigningOptions;
    };

    linux?: {
      icon?: string;
      category?: string;
      target?: ('appimage' | 'deb' | 'rpm' | 'snap')[];
      maintainer?: string;
    };
  };
}
```

### Checklist

- [ ] Production bundling with Bun.build()
- [ ] Minification and tree shaking
- [ ] Bytecode compilation
- [ ] Bundle analysis
- [ ] macOS .app structure
- [ ] Windows executable structure
- [ ] Linux application structure
- [ ] Icon generation (icns, ico, png)
- [ ] DMG installer with custom background
- [ ] PKG installer
- [ ] MSI installer (WiX)
- [ ] NSIS installer
- [ ] AppImage
- [ ] DEB package
- [ ] RPM package
- [ ] macOS code signing
- [ ] macOS notarization
- [ ] Windows code signing

### Success Criteria

- [ ] `bunlet build` produces optimized bundles
- [ ] `bunlet package` creates installers for all platforms
- [ ] Signed macOS app passes Gatekeeper
- [ ] Signed Windows app shows verified publisher
- [ ] All installers install and run correctly

---

## Phase 5: Distribution (v0.5.0)

**Goal**: Enable seamless application updates.

### Update Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Auto-Update System                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                       Update Server                             │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │ │
│  │  │GitHub Release│  │   S3/HTTP    │  │   Custom Server      │  │ │
│  │  │   Provider   │  │   Provider   │  │     Provider         │  │ │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                              │                                       │
│                              ▼                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                     Update Manifest                             │ │
│  │  {                                                              │ │
│  │    version: "1.2.0",                                           │ │
│  │    releaseDate: "2026-03-01",                                  │ │
│  │    files: [{ url, sha512, size }],                             │ │
│  │    releaseNotes: "..."                                         │ │
│  │  }                                                              │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                              │                                       │
│                              ▼                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    Client Application                           │ │
│  │                                                                 │ │
│  │  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐     │ │
│  │  │ Check   │ →  │Download │ →  │ Verify  │ →  │ Install │     │ │
│  │  │ Update  │    │ Update  │    │ Hash    │    │& Restart│     │ │
│  │  └─────────┘    └─────────┘    └─────────┘    └─────────┘     │ │
│  │       │              │              │              │           │ │
│  │       └──────────────┴──────────────┴──────────────┘           │ │
│  │                         Events                                  │ │
│  │  checking → available → downloading → downloaded → installing  │ │
│  │                                                                 │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Update Manifest Format

```yaml
# latest.yml (per platform)
version: 1.2.0
releaseDate: '2026-03-01T00:00:00.000Z'
releaseNotes: |
  ## What's New
  - Feature A
  - Bug fix B
files:
  - url: MyApp-1.2.0-mac-arm64.dmg
    sha512: abc123...
    size: 52428800
  - url: MyApp-1.2.0-mac-arm64.zip
    sha512: def456...
    size: 48000000
path: MyApp-1.2.0-mac-arm64.dmg
sha512: abc123...
releaseDate: '2026-03-01T00:00:00.000Z'

# For differential updates
blockMapSize: 52428
blockMapSha512: xyz789...
```

### Auto-Updater API

```typescript
// auto-updater.ts
export interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes?: string;
  files: UpdateFile[];
}

export interface UpdateFile {
  url: string;
  sha512: string;
  size: number;
}

export interface ProgressInfo {
  total: number;
  transferred: number;
  percent: number;
  bytesPerSecond: number;
}

export class AutoUpdater extends EventEmitter {
  // Configuration
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  allowDowngrade: boolean;
  channel: string;  // 'stable' | 'beta' | 'alpha'

  // Check for updates
  checkForUpdates(): Promise<UpdateCheckResult>;
  checkForUpdatesAndNotify(): Promise<UpdateCheckResult>;

  // Download
  downloadUpdate(): Promise<string[]>;

  // Install
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void;

  // Events
  on(event: 'error', listener: (error: Error) => void): this;
  on(event: 'checking-for-update', listener: () => void): this;
  on(event: 'update-available', listener: (info: UpdateInfo) => void): this;
  on(event: 'update-not-available', listener: (info: UpdateInfo) => void): this;
  on(event: 'download-progress', listener: (progress: ProgressInfo) => void): this;
  on(event: 'update-downloaded', listener: (info: UpdateInfo) => void): this;
}

export const autoUpdater: AutoUpdater;
```

### Update Configuration

```typescript
// bunlet.config.ts
export interface UpdateConfig {
  provider: 'github' | 's3' | 'generic';

  // GitHub provider
  github?: {
    owner: string;
    repo: string;
    private?: boolean;
    token?: string;
  };

  // S3 provider
  s3?: {
    bucket: string;
    region: string;
    path?: string;
  };

  // Generic HTTP provider
  generic?: {
    url: string;
    channel?: string;
  };

  // Channels
  channels?: {
    stable: string;
    beta?: string;
    alpha?: string;
  };

  // Differential updates
  differentialUpdates?: boolean;
}
```

### Differential Updates

```
┌──────────────────────────────────────────────────────────────┐
│                    Differential Update                        │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  Current Version (1.1.0)          New Version (1.2.0)        │
│  ┌──────────────────────┐         ┌──────────────────────┐   │
│  │ Block 1 [checksum A] │ ═══════ │ Block 1 [checksum A] │   │
│  │ Block 2 [checksum B] │         │ Block 2 [checksum X] │ ← │
│  │ Block 3 [checksum C] │ ═══════ │ Block 3 [checksum C] │   │
│  │ Block 4 [checksum D] │         │ Block 4 [checksum Y] │ ← │
│  │ Block 5 [checksum E] │ ═══════ │ Block 5 [checksum E] │   │
│  └──────────────────────┘         └──────────────────────┘   │
│                                                               │
│  Only download changed blocks (2, 4)                         │
│  Result: 60-90% smaller download                             │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### Publish Command

```bash
# Publish to GitHub Releases
bunlet publish --github

# Publish to S3
bunlet publish --s3

# Publish with release notes
bunlet publish --release-notes CHANGELOG.md

# Dry run
bunlet publish --dry-run
```

### Checklist

- [ ] AutoUpdater module
- [ ] `checkForUpdates()` implementation
- [ ] `downloadUpdate()` with progress
- [ ] `quitAndInstall()` implementation
- [ ] Update events
- [ ] GitHub Releases provider
- [ ] S3/generic HTTP provider
- [ ] Update manifest generation
- [ ] Differential updates (block map)
- [ ] Staged rollouts
- [ ] `bunlet publish` command

### Success Criteria

- [ ] App checks for updates on startup
- [ ] Update downloads in background
- [ ] App installs update on quit
- [ ] Differential updates reduce download size by 60%+
- [ ] Publish to GitHub Releases works

---

## Phase 6: CEF Mode (v0.6.0)

**Goal**: Provide consistent Chromium rendering option.

### CEF Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CEF Mode                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                      Main Process                               │ │
│  │                                                                 │ │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────────┐   │ │
│  │  │  Bun Runtime  │  │  CEF Browser  │  │   IPC Bridge      │   │ │
│  │  │  (App Logic)  │◄─┤   Process     │◄─┤  (JSON-RPC 2.0)   │   │ │
│  │  └───────────────┘  └───────────────┘  └───────────────────┘   │ │
│  │         │                   │                    │              │ │
│  └─────────┼───────────────────┼────────────────────┼──────────────┘ │
│            │                   │                    │                │
│            │          ┌────────┴────────┐           │                │
│            │          │                 │           │                │
│            ▼          ▼                 ▼           ▼                │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐             │
│  │ CEF Renderer │ │ CEF Renderer │ │    CEF GPU       │             │
│  │  Process 1   │ │  Process 2   │ │    Process       │             │
│  │  (Window 1)  │ │  (Window 2)  │ │  (Compositing)   │             │
│  └──────────────┘ └──────────────┘ └──────────────────┘             │
│                                                                      │
│  Process Model:                                                      │
│  - Browser: Main app logic + window management                      │
│  - Renderer: Per-window Chromium renderer (sandboxed)               │
│  - GPU: Hardware acceleration + compositing                         │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### CEF Package Structure

```
@bunlet/cef/
├── package.json
├── index.ts                   # CEF backend exports
├── bindings/
│   ├── cef-darwin-arm64.node
│   ├── cef-darwin-x64.node
│   ├── cef-win32-x64.node
│   └── cef-linux-x64.node
└── cef-binaries/
    ├── darwin-arm64/
    │   ├── Chromium Embedded Framework.framework/
    │   └── ...
    ├── darwin-x64/
    │   └── ...
    ├── win32-x64/
    │   ├── libcef.dll
    │   ├── chrome_elf.dll
    │   ├── icudtl.dat
    │   └── ...
    └── linux-x64/
        ├── libcef.so
        └── ...
```

### CEF Configuration

```typescript
// bunlet.config.ts
export interface CEFConfig {
  engine: 'cef';
  cef: {
    // Cache directory for CEF data
    cachePath?: string;

    // Remote debugging port (for Chrome DevTools)
    remoteDebuggingPort?: number;

    // GPU acceleration
    disableGPU?: boolean;

    // Sandbox (recommended for security)
    sandbox?: boolean;

    // Logging
    logSeverity?: 'verbose' | 'info' | 'warning' | 'error' | 'disable';

    // Chrome runtime (use Chrome's runtime instead of Alloy)
    chromeRuntime?: boolean;

    // User agent override
    userAgent?: string;

    // Extra Chromium flags
    extraChromiumArgs?: string[];
  };
}

// Example configuration
export default defineConfig({
  webview: {
    engine: 'cef',
    cef: {
      cachePath: './cef-cache',
      remoteDebuggingPort: 9222,
      disableGPU: false,
      sandbox: true,
    },
  },
});
```

### CEF Backend Implementation

```rust
// cef-bindings/src/lib.rs
use cef_sys::*;
use napi::*;

#[napi]
pub struct CEFApp {
    app: *mut cef_app_t,
    settings: CefSettings,
}

#[napi]
impl CEFApp {
    #[napi(constructor)]
    pub fn new(options: CEFOptions) -> Result<Self>;

    #[napi]
    pub fn initialize(&mut self) -> Result<()>;

    #[napi]
    pub fn shutdown(&mut self);

    #[napi]
    pub fn create_browser(&mut self, options: BrowserOptions) -> Result<CEFBrowser>;

    #[napi]
    pub fn do_message_loop_work(&self);
}

#[napi]
pub struct CEFBrowser {
    browser: *mut cef_browser_t,
}

#[napi]
impl CEFBrowser {
    #[napi]
    pub fn load_url(&self, url: String) -> Result<()>;

    #[napi]
    pub fn execute_javascript(&self, code: String) -> Result<()>;

    #[napi]
    pub fn get_dev_tools_url(&self) -> Option<String>;

    #[napi]
    pub fn close(&self);
}
```

### CEF Features

| Feature | Description |
|---------|-------------|
| Full DevTools | Complete Chrome DevTools via remote debugging |
| WebGL 2.0 | Hardware-accelerated graphics |
| WebGPU | Modern GPU API (Chromium 113+) |
| PDF Viewer | Built-in PDF rendering |
| Print | System print dialog integration |
| Media | Audio/video playback with codecs |
| Accessibility | Full accessibility tree |
| Extensions | Chrome extension support (optional) |

### Checklist

- [ ] CEF Rust bindings using `cef-sys`
- [ ] CEF app lifecycle management
- [ ] Browser window creation
- [ ] IPC bridge between Bun and CEF
- [ ] JavaScript execution in renderer
- [ ] DevTools via remote debugging
- [ ] Multi-process architecture
- [ ] CEF binary packaging per platform
- [ ] Separate `@bunlet/cef` npm package

### Success Criteria

- [ ] CEF mode works on all platforms
- [ ] Remote debugging accessible at configured port
- [ ] DevTools shows full Chrome DevTools
- [ ] Same IPC API as system WebView
- [ ] WebGL and WebGPU work
- [ ] PDF rendering works

---

## Phase 7: Optimization & Polish (v1.0.0)

**Goal**: Production-ready release with optimized performance.

### Size Optimization Techniques

| Technique | Savings | Implementation | Auto |
|-----------|---------|----------------|------|
| Strip symbols | 10-20% | `strip` on binaries | ✓ |
| LTO | 5-10% | Cargo `lto = true` | ✓ |
| Bytecode | 5-10% | `--bytecode` flag | - |
| Minify | 20-30% | Bun.build minify | ✓ |
| Tree shake | 10-20% | Dead code elimination | ✓ |
| UPX | 30-50% | UPX compression | - |
| LZMA | 30-40% | Installer compression | ✓ |
| Assets | varies | Image optimization | - |

### Target Sizes

| Mode | Executable | Installer |
|------|------------|-----------|
| System WebView | 15-25MB | 20-40MB |
| CEF Mode | 80-100MB | 100-150MB |

### Performance Benchmarks

| Metric | Target | Measurement |
|--------|--------|-------------|
| Cold start | <500ms | Time to first window visible |
| Window creation | <100ms | BrowserWindow constructor |
| IPC round-trip | <5ms | invoke() latency |
| Memory (idle) | <50MB | Main process RSS |
| Memory (CEF) | <150MB | With one window |

### Performance Optimizations

```rust
// Lazy loading native modules
#[napi]
pub fn lazy_init() {
    // Initialize only when first window is created
}

// Pre-warm WebView on supported platforms
#[napi]
pub fn prewarm_webview() {
    // macOS: Pre-create WKWebView process
    // Windows: Initialize WebView2 environment
}

// IPC optimization: batch messages
#[napi]
pub fn send_batch(messages: Vec<IPCMessage>) {
    // Combine multiple IPC calls
}
```

### Documentation

```
docs/
├── getting-started/
│   ├── installation.md
│   ├── quick-start.md
│   └── configuration.md
├── guides/
│   ├── window-management.md
│   ├── ipc-communication.md
│   ├── native-modules.md
│   ├── multi-window.md
│   └── security.md
├── api/
│   ├── app.md
│   ├── browser-window.md
│   ├── ipc.md
│   ├── dialog.md
│   ├── menu.md
│   ├── tray.md
│   ├── notification.md
│   ├── clipboard.md
│   ├── shell.md
│   └── auto-updater.md
├── packaging/
│   ├── building.md
│   ├── installers.md
│   ├── code-signing.md
│   └── size-optimization.md
├── webview/
│   ├── system-webview.md
│   ├── cef-mode.md
│   └── comparison.md
├── migration/
│   ├── from-electron.md
│   └── from-tauri.md
└── advanced/
    ├── architecture.md
    ├── debugging.md
    └── troubleshooting.md
```

### Test Suite

```typescript
// Test categories
describe('Unit Tests', () => {
  describe('App', () => { /* ... */ });
  describe('BrowserWindow', () => { /* ... */ });
  describe('IPC', () => { /* ... */ });
});

describe('Integration Tests', () => {
  describe('Window Lifecycle', () => { /* ... */ });
  describe('IPC Communication', () => { /* ... */ });
  describe('Native APIs', () => { /* ... */ });
});

describe('E2E Tests', () => {
  describe('macOS', () => { /* ... */ });
  describe('Windows', () => { /* ... */ });
  describe('Linux', () => { /* ... */ });
});

describe('Performance Tests', () => {
  test('cold start < 500ms', async () => { /* ... */ });
  test('window creation < 100ms', async () => { /* ... */ });
  test('IPC round-trip < 5ms', async () => { /* ... */ });
});
```

### CI/CD Pipeline

```yaml
# GitHub Actions
name: CI

on: [push, pull_request]

jobs:
  test:
    strategy:
      matrix:
        os: [macos-14, windows-latest, ubuntu-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun test

  build:
    needs: test
    strategy:
      matrix:
        include:
          - os: macos-14
            target: darwin-arm64
          - os: macos-13
            target: darwin-x64
          - os: windows-latest
            target: win32-x64
          - os: ubuntu-latest
            target: linux-x64
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun run build:native
      - uses: actions/upload-artifact@v4
        with:
          name: native-${{ matrix.target }}
          path: bunlet-native/artifacts/

  release:
    needs: build
    if: startsWith(github.ref, 'refs/tags/v')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
      - uses: softprops/action-gh-release@v1
        with:
          files: native-*/*
```

### Checklist

- [ ] Strip symbols from binaries
- [ ] Enable LTO in Cargo
- [ ] Bytecode compilation option
- [ ] UPX compression option
- [ ] Cold start <500ms
- [ ] Window creation <100ms
- [ ] IPC round-trip <5ms
- [ ] Memory usage <50MB idle
- [ ] Complete API documentation
- [ ] Getting started guide
- [ ] Migration guides (Electron, Tauri)
- [ ] Unit test coverage >80%
- [ ] Integration tests
- [ ] E2E tests on all platforms
- [ ] CI/CD pipeline
- [ ] Example applications

### Success Criteria

- [ ] All performance targets met
- [ ] Documentation complete
- [ ] Test coverage >80%
- [ ] CI passes on all platforms
- [ ] No critical bugs
- [ ] v1.0.0 release published

---

## Future Considerations (Post v1.0)

These features may be considered for future versions:

- **Mobile Support**: Capacitor-like mobile builds
- **Cloud Builds**: CI/CD service for building
- **App Store**: Mac App Store, Microsoft Store support
- **Plugins Marketplace**: Community plugin distribution
- **Visual Builder**: GUI for app configuration
- **Native Modules**: Easy native code integration
- **WebAssembly**: WASM module support
- **WebContainer**: Run Node.js in WebView

---

## Contributing

Want to help? Check out our [Contributing Guide](CONTRIBUTING.md) and pick an item from the roadmap!

## Tracking Progress

- Issues labeled `roadmap` track roadmap items
- Each phase has a milestone in the issue tracker
- PRs reference the roadmap item they address

---

*Last updated: February 2026*
