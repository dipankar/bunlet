# @bunlet/cef

Chromium Embedded Framework (CEF) backend for Bunlet. Provides a full Chromium runtime as an alternative to the system WebView engine.

[![npm version](https://img.shields.io/npm/v/@bunlet/cef)](https://www.npmjs.com/package/@bunlet/cef)
[![crates.io](https://img.shields.io/crates/v/bunlet-cef-native)](https://crates.io/crates/bunlet-cef-native)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/dipankar/bunlet/blob/main/LICENSE)

## Features

- **Full Chromium** — Embedded Chromium 146+ with complete Web API support
- **Consistent rendering** — Identical behavior across macOS, Windows, and Linux
- **DevTools** — Built-in Chrome DevTools for debugging
- **Optional** — Install only if you need Chromium; system WebView is the default

## Install

```bash
bun add @bunlet/cef
```

## Usage

Set the `BUNLET_ENGINE=cef` environment variable or configure it in your `bunlet.config.ts`:

```typescript
export default {
  engine: 'cef'
};
```

## Supported Platforms

| Platform | Architecture | Status |
|----------|--------------|--------|
| macOS    | x64          | ✅ Beta |
| Linux    | x64          | ✅ Beta |
| Windows  | x64          | 🚧 In Progress |

## License

MIT — see [LICENSE](https://github.com/dipankar/bunlet/blob/main/LICENSE) for details.
