# CLI Overview

The Bunlet CLI provides commands for creating, developing, building, and packaging desktop applications.

## Installation

```bash
# Global (recommended)
bun add -g @bunlet/cli

# Project-local
bun add -D @bunlet/cli
```

## Command Summary

| Command | Description |
|---------|-------------|
| `bunlet create` | Create a new project |
| `bunlet dev` | Start development server |
| `bunlet build` | Build for production |
| `bunlet package` | Create distributables |
| `bunlet icons` | Generate app icons |

## Global Options

These options work with all commands:

```bash
bunlet <command> [options]

Options:
  -v, --version       Show version number
  -h, --help          Show help
  --verbose           Enable verbose logging
  --config <path>     Path to config file (default: bunlet.config.ts)
  --cwd <dir>         Set working directory
```

## Command Reference

### `bunlet create <app-name>`

Create a new Bunlet application.

```bash
bunlet create my-app
bunlet create my-app --template default
bunlet create my-app --template default --webview cef
```

See [bunlet create](create.md) for details.

### `bunlet dev`

Start the development server with hot reload.

```bash
bunlet dev
bunlet dev --port 3000
bunlet dev --no-open
```

See [bunlet dev](dev.md) for details.

### `bunlet build`

Build the application for production.

```bash
bunlet build
bunlet build --target darwin
bunlet build --webview cef
```

See [bunlet build](build.md) for details.

### `bunlet package`

Create distributable installers.

```bash
bunlet package
bunlet package --win --format exe
bunlet package --sign
```

See [bunlet package](package.md) for details.

### `bunlet icons`

Generate app icons from a source image.

```bash
bunlet icons ./icon.png
bunlet icons ./icon.svg --output ./resources
```

Generates:
- `icon.icns` (macOS)
- `icon.ico` (Windows)
- `icons/` folder with multiple sizes (Linux)

## Environment Variables

| Variable | Description |
|----------|-------------|
| `BUNLET_CONFIG` | Path to config file |
| `DEBUG` | Enable debug logging (`DEBUG=bunlet:*`) |
| `NO_COLOR` | Disable colored output |

### Code Signing Variables

**macOS:**
| Variable | Description |
|----------|-------------|
| `APPLE_ID` | Apple ID email |
| `APPLE_PASSWORD` | App-specific password |
| `APPLE_TEAM_ID` | Team ID for notarization |
| `CSC_LINK` | Path to .p12 certificate |
| `CSC_KEY_PASSWORD` | Certificate password |

**Windows:**
| Variable | Description |
|----------|-------------|
| `WIN_CSC_LINK` | Path to .pfx certificate |
| `WIN_CSC_KEY_PASSWORD` | Certificate password |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Invalid arguments |
| 3 | Build failed |
| 4 | Packaging failed |
| 5 | Signing failed |

## Configuration File

Commands read from `bunlet.config.ts` by default:

```typescript
// bunlet.config.ts
import { defineConfig } from 'bunlet/config';

export default defineConfig({
  appId: 'com.example.myapp',
  productName: 'My App',
  version: '1.0.0',
  // ...
});
```

Override with `--config`:
```bash
bunlet build --config ./config/production.ts
```

## Programmatic API

Use the CLI programmatically:

```typescript
import { build, createPackage } from '@bunlet/cli';

// Build
await build({
  target: 'darwin',
  minify: true,
});

// Package
await createPackage({
  target: 'darwin',
  format: ['dmg'],
  sign: true,
});
```

## Related

- [bunlet create](create.md)
- [bunlet dev](dev.md)
- [bunlet build](build.md)
- [bunlet package](package.md)
- [Advanced Usage](advanced.md)
