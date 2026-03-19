# Installation

This guide will help you install Bunlet and set up your development environment.

## Prerequisites

### Bun

Bunlet requires [Bun](https://bun.sh) v1.0.0 or later. Install it with:

=== "macOS / Linux"

    ```bash
    curl -fsSL https://bun.sh/install | bash
    ```

=== "Windows"

    ```powershell
    powershell -c "irm bun.sh/install.ps1 | iex"
    ```

Verify the installation:

```bash
bun --version
```

### Platform-Specific Dependencies

=== "Linux"

    On Linux, you need the following system dependencies:

    ```bash
    # Ubuntu/Debian
    sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev

    # Fedora
    sudo dnf install webkit2gtk4.1-devel gtk3-devel libappindicator-gtk3-devel

    # Arch
    sudo pacman -S webkit2gtk-4.1 gtk3 libappindicator-gtk3
    ```

=== "macOS"

    No additional dependencies required. Bunlet uses the system WebView.

=== "Windows"

    No additional dependencies required. Bunlet uses WebView2 (included in Windows 10/11).

## Installation Methods

### Create a New Project (Recommended)

The easiest way to get started is using the CLI to scaffold a new project:

```bash
bun create bunlet my-app
cd my-app
```

This creates a new project with the recommended structure and configuration.

### Add to Existing Project

To add Bunlet to an existing Bun project:

```bash
bun add bunlet
```

### Install CLI Globally

For access to the CLI tools anywhere:

```bash
bun add -g bunlet-cli
```

## Verify Installation

Create a simple test file to verify everything is working:

```typescript title="test.ts"
import { app, BrowserWindow } from 'bunlet';

await app.whenReady();
console.log('Bunlet is ready!');

const win = new BrowserWindow({ width: 400, height: 300 });
win.loadURL('data:text/html,<h1>Hello Bunlet!</h1>');

app.run();
```

Run it:

```bash
bun run test.ts
```

You should see a window with "Hello Bunlet!" displayed.

## Next Steps

Now that you have Bunlet installed, continue to the [Quick Start](quick-start.md) guide to build your first app.
