# Installation

This guide covers how to install Bunlet and its prerequisites.

## Prerequisites

### Bun Runtime

Bunlet requires [Bun](https://bun.sh) 1.0 or later.

**macOS / Linux:**
```bash
curl -fsSL https://bun.sh/install | bash
```

**Windows:**
```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

Verify installation:
```bash
bun --version
# Should output: 1.x.x
```

### Rust Toolchain

Bunlet requires a Rust compiler for the native module. Install via [rustup](https://rustup.rs):

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

Verify:
```bash
rustc --version   # stable >= 1.70
cargo --version
```

### Platform Requirements

#### Windows
- Windows 10 version 1809 or later
- [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/) (auto-installed with Windows 11, or via Edge)

#### macOS
- macOS 10.15 (Catalina) or later
- Xcode Command Line Tools:
  ```bash
  xcode-select --install
  ```

#### Linux
- WebKitGTK 4.1
- GTK 3
- AppIndicator (for system tray support)

**Ubuntu/Debian:**
```bash
sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev libx11-dev librsvg2-dev
```

**Fedora:**
```bash
sudo dnf install webkit2gtk4.1-devel gtk3-devel libappindicator-gtk3-devel libX11-devel librsvg2-devel
```

**Arch:**
```bash
sudo pacman -S webkit2gtk-4.1 gtk3 libappindicator-gtk3
```

## Installing Bunlet CLI

### Global Installation (Recommended)

```bash
bun add -g @bunlet/cli
```

Verify installation:
```bash
bunlet --version
```

### Project-Local Installation

For CI/CD or project-specific versions:

```bash
bun add -D @bunlet/cli
```

Run with:
```bash
bunx bunlet <command>
# or
bun run bunlet <command>
```

## Using from Source

For contributors or those who want the latest development version:

```bash
git clone https://github.com/dipankar/bunlet
cd bunlet
bun run setup    # install + build native + build TypeScript
bun run doctor   # verify your environment
```

## Installing CEF Mode (Optional)

If you need consistent Chromium rendering across all platforms:

```bash
bun add @bunlet/cef
```

This downloads platform-specific CEF binaries (~100MB).

See [CEF Mode](../webview/cef-mode.md) for configuration details.

## Updating Bunlet

```bash
# Global installation
bun add -g @bunlet/cli@latest

# Project-local
bun add -D @bunlet/cli@latest
```

## Troubleshooting

### "bunlet: command not found"

Ensure Bun's global bin directory is in your PATH:

```bash
# Add to ~/.bashrc, ~/.zshrc, or equivalent
export PATH="$HOME/.bun/bin:$PATH"
```

### WebView2 Not Found (Windows)

Install the WebView2 Runtime:
1. Download from [Microsoft](https://developer.microsoft.com/microsoft-edge/webview2/)
2. Run the Evergreen Bootstrapper

### WebKitGTK Issues (Linux)

Ensure you have the development packages:

```bash
pkg-config --modversion webkit2gtk-4.1
```

If this fails, install the package for your distribution (see Platform Requirements above).

### Permission Denied (macOS)

If you encounter code signing issues:
```bash
xattr -cr /path/to/app.app
```

### Native Module Build Fails

Make sure Rust is installed and up to date:
```bash
rustc --version   # Should be >= 1.70
cargo --version
```

On Linux, make sure all dev libraries are installed (see Platform Requirements).

## Next Steps

- [Quick Start](quick-start.md) - Create your first app in 5 minutes
- [Project Structure](project-structure.md) - Understand the file layout
- [Configuration](configuration.md) - Customize your app