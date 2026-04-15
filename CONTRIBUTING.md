# Contributing to Bunlet

Thanks for your interest in contributing! Here's how to get started.

## Prerequisites

- **Bun** >= 1.0 ([install](https://bun.sh))
- **Rust** stable >= 1.70 ([install via rustup](https://rustup.rs))
- **Xcode Command Line Tools** (macOS): `xcode-select --install`
- **WebView2** (Windows 10/11, usually pre-installed)
- **Linux dev libraries** (Ubuntu/Debian):
  ```
  sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev libx11-dev librsvg2-dev
  ```
  Fedora:
  ```
  sudo dnf install webkit2gtk4.1-devel gtk3-devel libappindicator-gtk3-devel libX11-devel librsvg2-devel
  ```

## Setup

One command to install dependencies, build the native module, and build the TypeScript packages:

```bash
git clone https://github.com/bunlet/bunlet && cd bunlet
bun run setup
```

Or step by step:

```bash
bun install                    # Install JS dependencies
bun run build:native           # Build Rust native module (cargo build --release)
bun run build:packages         # Build TypeScript packages (bunlet + CLI)
```

## Verify Your Setup

```bash
bun run doctor
```

This checks that Bun, Rust, the native module, and TypeScript packages are all in place.

## Run the Examples

```bash
cd examples/hello-world && bun run main.ts
```

All examples under `examples/` use `workspace:*` to link to the local packages.

| Example | Run | What it demonstrates |
|---|---|---|
| hello-world | `bun run main.ts` | Basic window, IPC |
| clipboard-manager | `bun run main.ts` | Clipboard, tray, global shortcuts |
| file-browser | `bun run main.ts` | File dialogs, file watcher, shell |
| multi-window | `bun run main.ts` | Parent/child windows, settings |
| power-monitor | `bun run main.ts` | Battery, idle state, power events |
| tray-app | `bun run main.ts` | System tray, notifications |
| notes-app | `bun run main.ts` | Full app: menus, dialogs, IPC, persistence |

### notes-app

The notes-app uses Vue 3 + Vite for its renderer. In dev mode, start both servers:

```bash
cd examples/notes-app
bun run main.ts        # Main process (looks for Vite on :5173 in dev)
cd renderer && bun install && bun run dev   # Renderer dev server
```

## Run Tests

```bash
bun test                # All tests
bun test packages/bunlet/src/web-contents.test.ts  # Single file
```

## Development Workflow

1. Create a feature branch: `git checkout -b feat/my-feature`
2. Make changes
3. Run `bun run doctor` to verify environment
4. Run `bun test` to check for regressions
5. Build: `bun run build:packages`
6. Test with an example: `cd examples/hello-world && bun run main.ts`

## Project Structure

```
packages/
  bunlet/              # Core runtime (BrowserWindow, app, IPC, native APIs)
  bunlet-native/       # Rust native module (tao + wry webview backend)
  bunlet-cef/          # CEF backend proxy
  bunlet-cef-native/   # CEF Rust native module
  bunlet-cli/          # CLI (create, dev, build, package)
examples/              # Example apps (7 demos)
docs/                  # Documentation
scripts/               # Build and dev scripts
```

## Code Style

- No comments unless asked
- TypeScript for all JS source
- `cargo check` and `tsc --noEmit` must pass
- `bun test` must pass

## Reporting Issues

Open an issue at [GitHub Issues](https://github.com/anomalyco/bunlet/issues).