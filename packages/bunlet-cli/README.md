# @bunlet/cli

> Official CLI for the Bunlet desktop framework — scaffold, develop, build, and package cross-platform desktop apps with a single command.

[![npm version](https://img.shields.io/npm/v/@bunlet/cli)](https://www.npmjs.com/package/@bunlet/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/dipankar/bunlet/blob/main/LICENSE)

The Bunlet CLI is the fastest way to create and ship cross-platform desktop apps using Bun and native WebViews. One binary — every command you need from project creation to production installers.

## Quick Start

Create and run an app in 30 seconds:

```bash
bunx @bunlet/cli create my-app
cd my-app
bun run dev
```

**What happens:**
1. `create` scaffolds a full project with TypeScript, a preload script, an HTML renderer, and a `package.json` with dev/build/package scripts
2. `dev` starts the app with hot reload and file watching — edit your code and the window updates instantly

## Install

```bash
# Global install
bun add -g @bunlet/cli

# Or run on-demand without installing
bunx @bunlet/cli create my-app
```

## Commands

### `bunlet create <name>`

Scaffold a new Bunlet project from official templates.

```bash
bunlet create my-app
```

**Output:**

```
  Bunlet v0.3.0 — Create a new Bunlet project

  ✓ Created project directory: my-app/
  ✓ Generated package.json
  ✓ Generated tsconfig.json
  ✓ Generated main.ts (main process)
  ✓ Generated preload.ts (context bridge)
  ✓ Generated index.html (renderer)
  ✓ Generated bunlet.config.ts (build config)
  ✓ Installed dependencies (43 packages)

  Next steps:
    cd my-app
    bun run dev
```

**Flags:**

| Flag | Description | Default |
|------|-------------|---------|
| `-t, --template <name>` | Project template (`default`) | `default` |
| `--webview <engine>` | WebView engine (`system`, `cef`) | `system` |
| `--no-typescript` | Use JavaScript instead of TypeScript | TypeScript |
| `--no-git` | Skip git initialization | Initialize git |
| `--no-install` | Skip dependency installation | Install deps |

---

### `bunlet dev`

Start the development server with hot module replacement and file watching.

```bash
bunlet dev
```

**Output:**

```
  Bunlet v0.3.0 — Development server

  ✓ Native module loaded (bunlet-native v0.1.0)
  ✓ WebView engine: system (WKWebView)
  ➜ Dev server running at: http://localhost:5173
  ➜ Watching: src/ renderer/ preload.ts

  [HMR] renderer/styles.css updated in 12ms
  [HMR] renderer/app.tsx updated in 37ms
```

Edit any file in your project — the renderer hot-reloads CSS instantly and JS modules update without a full page refresh. When the main process changes, the app restarts automatically.

**Flags:**

| Flag | Description | Default |
|------|-------------|---------|
| `-p, --port <port>` | Dev server port | `5173` |
| `--host <host>` | Dev server host | `localhost` |
| `--no-hmr` | Disable hot module replacement | HMR enabled |
| `--no-open` | Don't open window automatically | Open window |
| `--devtools` | Open DevTools on start | Off |
| `--webview <engine>` | WebView engine override (`system`, `cef`) | from config |

---

### `bunlet build`

Build your app for production with optimized bundles and native addons.

```bash
bunlet build
```

**Output:**

```
  Bunlet v0.3.0 — Production build

  ✓ Bundled main process (main.js — 142KB)
  ✓ Bundled preload script (preload.js — 12KB)
  ✓ Bundled renderer (index.html + assets — 384KB)
  ✓ Source maps generated (external)
  ✓ Baking app version: 1.0.0

  Output: dist/
  ├── main.js
  ├── preload.js
  └── renderer/
      ├── index.html
      ├── assets/
      └── ...

  Build completed in 1.2s
```

**Flags:**

| Flag | Description | Default |
|------|-------------|---------|
| `--target <target>` | Build target (`win32`, `darwin`, `linux`, `all`) | current platform |
| `--outdir <dir>` | Output directory | `./dist` |
| `--minify` / `--no-minify` | Minify output | Minify on |
| `--sourcemap [type]` | Source maps (`true`, `inline`, `external`) | Off |
| `--webview <engine>` | WebView engine override | from config |

---

### `bunlet package`

Package your app as platform-native installers.

```bash
bunlet package --mac
bunlet package --linux
bunlet package --win
```

**Output (macOS):**

```
  Bunlet v0.3.0 — Package application

  ✓ Building for darwin-arm64
  ✓ Creating .app bundle (MyApp.app)
  ✓ Code signing: Developer ID Application: ...
  ✓ Creating DMG installer
  ✓ Notarizing with Apple (submitted, waiting...)
  ✓ Notarization accepted

  Output: release/
  └── MyApp-1.0.0-arm64.dmg (28.4 MB)

  Package completed in 4m 32s
```

**Output (Linux):**

```
  Bunlet v0.3.0 — Package application

  ✓ Building for linux-x64
  ✓ Creating AppImage

  Output: release/
  └── MyApp-1.0.0-x86_64.AppImage (32.1 MB)

  Package completed in 1m 18s
```

**Output (Windows):**

```
  Bunlet v0.3.0 — Package application

  ✓ Building for win32-x64
  ✓ Creating MSI installer (WiX)

  Output: release/
  └── MyApp-1.0.0-x64.msi (24.7 MB)

  Package completed in 2m 05s
```

**Flags:**

| Flag | Description |
|------|-------------|
| `--mac` | Build macOS .dmg (and .app bundle) |
| `--win` | Build Windows .msi and .exe |
| `--linux` | Build Linux .AppImage and .deb |
| `--format <fmt>` | Specific format (`dmg`, `appimage`, `deb`, `msi`, `exe`) |
| `--sign` | Sign the package with configured identity |

---

### `bunlet doctor`

Check that your development environment has everything needed to build Bunlet apps.

```bash
bunlet doctor
```

**Output:**

```
  Bunlet Doctor — Environment Check
  ──────────────────────────────────

  ✓ Bun runtime            Bun 1.2.0
  ✓ Rust toolchain         rustc 1.85.0
  ✓ Cargo build system     cargo 1.85.0
  ✓ Node modules           node_modules/ exists
  ✓ Native module built    bunlet-native.darwin-arm64.node
  ✓ Core package built     packages/bunlet/dist/index.js
  ✓ CLI built              packages/bunlet-cli/dist/cli.js
  ✓ Platform libraries     macOS: native libraries bundled

  ──────────────────────────────────

  All checks passed! Your environment is ready.

  Try running: cd examples/hello-world && bun run main.ts
```

---

## Common Workflows

### Create, develop, ship

```bash
bunx @bunlet/cli create my-app    # scaffold
cd my-app && bun run dev           # develop with HMR
bun run build                      # production bundle
bun run package --mac              # macOS installer
```

### CI/CD with GitHub Actions

```yaml
- uses: oven-sh/setup-bun@v2
- run: bun add -g @bunlet/cli
- run: bunlet build
- run: bunlet package --linux
- uses: actions/upload-artifact@v4
  with:
    name: linux-package
    path: release/
```

### Multi-platform build matrix

```bash
bunlet build --target all
bunlet package --mac --linux --win
```

Produces:

```
release/
├── MyApp-1.0.0-arm64.dmg
├── MyApp-1.0.0-x86_64.AppImage
├── MyApp-1.0.0-x86_64.deb
└── MyApp-1.0.0-x64.msi
```

---

## Troubleshooting

### `bunlet: command not found`

The CLI isn't globally installed. Use `bunx @bunlet/cli` for one-off commands, or install globally:

```bash
bun add -g @bunlet/cli
```

### `Error: Cannot find module '@bunlet/native'`

The native Rust module hasn't been built. Run:

```bash
bun run build:native
```

### `Error: libwebkit2gtk-4.1.so.0: cannot open shared object file`

On Linux, you need the WebKitGTK development libraries:

```bash
# Ubuntu / Debian
sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev

# Fedora
sudo dnf install webkit2gtk4.1-devel gtk3-devel

# Arch
sudo pacman -S webkit2gtk-4.1 gtk3
```

### `Build fails with "xcode-select: note: no developer tools were found"`

On macOS, install the Xcode Command Line Tools:

```bash
xcode-select --install
```

### `Error: WebView2 not found on Windows`

Windows 10 requires the WebView2 Runtime. Download it from [Microsoft](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) or ensure Windows is up to date (Windows 11 includes it by default).

---

## Related Packages

- [@bunlet/core](https://www.npmjs.com/package/@bunlet/core) — the runtime your app uses (`app`, `BrowserWindow`, IPC, native APIs)
- [@bunlet/cef](https://www.npmjs.com/package/@bunlet/cef) — optional Chromium backend (use with `--webview cef`)
- [Bunlet on GitHub](https://github.com/dipankar/bunlet) — source code, examples, and contribution guide

## License

MIT — see [LICENSE](https://github.com/dipankar/bunlet/blob/main/LICENSE) for details.
