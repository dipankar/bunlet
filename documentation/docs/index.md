# Bunlet

**Build desktop apps with Bun**

Bunlet is a cross-platform desktop application framework that lets you build native desktop apps using web technologies (HTML, CSS, JavaScript/TypeScript) with the speed and simplicity of [Bun](https://bun.sh).

---

## Why Bunlet?

- **Fast** - Built on Bun, the fastest JavaScript runtime
- **Type-safe** - First-class TypeScript support with Zod-validated IPC
- **Cross-platform** - Windows, macOS, and Linux from a single codebase
- **Native APIs** - Full access to system features (menus, dialogs, notifications, tray, and more)
- **Modern** - No legacy baggage, designed for today's development workflows

## Quick Start

```bash
# Create a new Bunlet app
bun create bunlet my-app

# Navigate to the project
cd my-app

# Start development server
bun run dev
```

## Minimal Example

```typescript
import { app, BrowserWindow } from 'bunlet';

// Wait for app to be ready
await app.whenReady();

// Create a window
const win = new BrowserWindow({
  width: 800,
  height: 600,
  title: 'My App'
});

// Load content
win.loadFile('index.html');

// Start the event loop
app.run();
```

## Features at a Glance

| Feature | Description |
|---------|-------------|
| **Windows** | Create and manage multiple windows with full control over size, position, and behavior |
| **IPC** | Type-safe communication between main process and renderer with Zod schema validation |
| **Menus** | Application menus and context menus with keyboard shortcuts |
| **Dialogs** | Native file open/save dialogs and message boxes |
| **Notifications** | Desktop notifications with actions and replies |
| **System Tray** | System tray icons with context menus |
| **Clipboard** | Read and write to the system clipboard |
| **Shell** | Open URLs, files, and interact with the file manager |
| **Global Shortcuts** | Register system-wide keyboard shortcuts |
| **Auto Updater** | Automatic application updates from GitHub or custom servers |

## Architecture

Bunlet consists of three main packages:

- **bunlet** - The main framework API (TypeScript)
- **bunlet-cli** - Command-line tools for development and building
- **bunlet-native** - Native bindings (Rust) for system integration

```
┌─────────────────────────────────────────┐
│            Your Application             │
├─────────────────────────────────────────┤
│              bunlet (API)               │
├─────────────────────────────────────────┤
│           bunlet-native (Rust)          │
├──────────────────┬──────────────────────┤
│   tao (Window)   │    wry (WebView)     │
└──────────────────┴──────────────────────┘
```

## Next Steps

<div class="grid cards" markdown>

-   :material-download:{ .lg .middle } **Installation**

    ---

    Install Bunlet and set up your development environment

    [:octicons-arrow-right-24: Getting Started](getting-started/installation.md)

-   :material-rocket-launch:{ .lg .middle } **Quick Start**

    ---

    Build your first Bunlet app in 5 minutes

    [:octicons-arrow-right-24: Quick Start](getting-started/quick-start.md)

-   :material-book-open-variant:{ .lg .middle } **Guides**

    ---

    Learn how to use Bunlet's features

    [:octicons-arrow-right-24: Guides](guides/windows.md)

-   :material-api:{ .lg .middle } **API Reference**

    ---

    Complete API documentation

    [:octicons-arrow-right-24: API Reference](api/app.md)

</div>
