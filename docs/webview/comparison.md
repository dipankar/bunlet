# WebView Engine Comparison

Bunlet supports two WebView backends. This guide helps you choose the right one.

## Overview

| Feature | System WebView | CEF Mode |
|---------|---------------|----------|
| **Engine** | OS native | Chromium |
| **Binary Size** | +0MB | +100MB |
| **Total App Size** | 20-40MB | 120-150MB |
| **Rendering** | Varies by OS | Identical everywhere |
| **Updates** | Via OS | Bundled version |
| **DevTools** | Basic | Full Chrome DevTools |

## System WebView (Default)

Uses the operating system's built-in WebView:

| Platform | Engine | Version |
|----------|--------|---------|
| Windows | WebView2 | Chromium-based (Edge) |
| macOS | WKWebView | WebKit (Safari) |
| Linux | WebKitGTK | WebKit |

### Pros

- **Small binaries** - No browser bundled (~20-40MB total)
- **Fast startup** - No Chromium to initialize
- **Low memory** - Shares engine with system
- **Auto-updates** - Browser updates via OS
- **Native feel** - Matches platform conventions

### Cons

- **Rendering differences** - WebKit vs Chromium
- **Feature gaps** - Some APIs unavailable on WebKit
- **Testing complexity** - Must test on all platforms
- **Version dependency** - Relies on user's OS version

### Best For

- Most applications
- Resource-constrained environments
- Apps prioritizing download size
- Simple UIs without complex CSS/JS

### Configuration

```typescript
// bunlet.config.ts
export default defineConfig({
  webview: {
    engine: 'system', // Default
  },
});
```

## CEF Mode

Bundles Chromium Embedded Framework:

### Pros

- **Consistent rendering** - Same Chromium everywhere
- **Latest features** - Control exact Chrome version
- **Full DevTools** - Complete Chrome DevTools
- **No dependencies** - Works without WebView2/WebKit
- **Predictable behavior** - No cross-platform surprises

### Cons

- **Large binaries** - +100MB download
- **Slower startup** - Chromium initialization
- **Higher memory** - Full browser engine
- **Manual updates** - Must update CEF version
- **Build complexity** - Longer build times

### Best For

- Complex web applications
- Pixel-perfect rendering requirements
- Apps using cutting-edge CSS/JS
- When WebKit compatibility is problematic

### Configuration

```typescript
// bunlet.config.ts
export default defineConfig({
  webview: {
    engine: 'cef',
    cef: {
      cachePath: './cef-cache',
      remoteDebuggingPort: 9222, // Optional
    },
  },
});
```

### Installation

```bash
bun add @bunlet/cef
```

## Feature Comparison

### CSS Support

| Feature | System WebView | CEF |
|---------|---------------|-----|
| CSS Grid | Yes | Yes |
| CSS Subgrid | Safari only | Yes |
| Container Queries | Limited | Yes |
| :has() selector | Safari only | Yes |
| @layer | Yes | Yes |
| Backdrop Filter | Yes | Yes |

### JavaScript APIs

| Feature | System WebView | CEF |
|---------|---------------|-----|
| ES2024 | Mostly | Yes |
| WebAssembly | Yes | Yes |
| WebGL 2.0 | Yes | Yes |
| WebGPU | Safari only | Yes |
| ResizeObserver | Yes | Yes |
| Intl APIs | Yes | Yes |

### DevTools

| Feature | System WebView | CEF |
|---------|---------------|-----|
| Elements panel | Yes | Yes |
| Console | Yes | Yes |
| Network | Limited | Full |
| Performance | Limited | Full |
| Memory | No | Yes |
| Lighthouse | No | Yes |
| Remote debugging | No | Yes |

## Decision Guide

### Choose System WebView if:

1. **Size matters** - Users on slow connections
2. **Simple UI** - Standard HTML/CSS without edge cases
3. **Resource constraints** - Low-end hardware
4. **Most apps** - Default choice for typical applications

### Choose CEF if:

1. **Complex UI** - Advanced CSS, animations, Canvas
2. **Web app port** - Porting existing web application
3. **Consistency critical** - Exact same rendering required
4. **DevTools needed** - Complex debugging requirements
5. **WebKit issues** - Specific Safari/WebKit bugs

## Hybrid Approach

You can build both versions:

```bash
# System WebView (small)
bunlet build --webview system

# CEF (large but consistent)
bunlet build --webview cef
```

Offer users a choice or use CEF only where needed.

## Testing Strategy

### System WebView

Test on all platforms:

```yaml
# CI configuration
test:
  strategy:
    matrix:
      os: [macos-latest, windows-latest, ubuntu-latest]
```

### Key Differences to Test

1. **Font rendering** - WebKit renders fonts differently
2. **Scrolling** - Momentum scrolling on macOS
3. **Form controls** - Native vs custom styling
4. **Date/time pickers** - Platform variations
5. **Animations** - Performance differences

## Migration

### From System WebView to CEF

1. Install CEF:
   ```bash
   bun add @bunlet/cef
   ```

2. Update config:
   ```typescript
   export default defineConfig({
     webview: { engine: 'cef' },
   });
   ```

3. Rebuild:
   ```bash
   bunlet build
   ```

### From CEF to System WebView

1. Remove CEF:
   ```bash
   bun remove @bunlet/cef
   ```

2. Update config:
   ```typescript
   export default defineConfig({
     webview: { engine: 'system' },
   });
   ```

3. Test on all platforms!

## Related

- [System WebView](system-webview.md)
- [CEF Mode](cef-mode.md)
- [Size Optimization](../packaging/size-optimization.md)
