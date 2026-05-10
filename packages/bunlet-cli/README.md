# @bunlet/cli

Official CLI for the Bunlet desktop framework. Scaffold, develop, build, and package cross-platform desktop apps with a single command.

[![npm version](https://img.shields.io/npm/v/@bunlet/cli)](https://www.npmjs.com/package/@bunlet/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/dipankar/bunlet/blob/main/LICENSE)

## Features

- **`bunlet create`** — Scaffold a new desktop app from official templates
- **`bunlet dev`** — Run your app with hot reload and file watching
- **`bunlet build`** — Bundle for production with optimized native addons
- **`bunlet package`** — Generate platform installers (.dmg, .AppImage, .exe, .msi)
- **TypeScript-first** — All templates ship with strict TypeScript out of the box

## Install

```bash
bun add -g @bunlet/cli
```

Or run directly with:

```bash
bunx @bunlet/cli create my-app
```

## Commands

```bash
bunlet create <name>     # Create a new Bunlet project
bunlet dev               # Start development server with hot reload
bunlet build             # Build for production
bunlet package --mac     # Package for macOS
bunlet package --linux   # Package for Linux
bunlet package --win     # Package for Windows
```

## Documentation

- [CLI Reference](https://bunlet.dev/docs/cli)
- [Packaging Guide](https://bunlet.dev/docs/packaging)

## License

MIT — see [LICENSE](https://github.com/dipankar/bunlet/blob/main/LICENSE) for details.
