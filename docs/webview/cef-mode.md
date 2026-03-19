# CEF Mode

CEF mode enables Bunlet to load the `@bunlet/cef` backend instead of the system WebView backend.

## Enable CEF

Install the package:

```bash
bun add @bunlet/cef
```

Use CEF in your config:

```ts
import { defineConfig } from 'bunlet/config';

export default defineConfig({
  webview: {
    engine: 'cef',
  },
});
```

Or override at runtime/build time:

```bash
bunlet dev --webview cef
bunlet build --webview cef
```

## Build Native CEF Addon

`@bunlet/cef` ships a platform-specific native addon. Build it with:

```bash
bun --filter @bunlet/cef run build
```

If your Bun version does not support `--filter`, run:

```bash
cd packages/bunlet-cef
bun run build
```

## Current Status (Experimental Scaffold)

- Window lifecycle APIs are wired through a dedicated CEF native addon package.
- Packaging now copies the platform-specific CEF addon into output bundles.
- Renderer integration (full Chromium rendering + IPC bridge) is still in progress.
- DevTools APIs currently return scaffold errors in CEF mode.

## Optional Native Fallback

By default, CEF mode does **not** fall back to `@bunlet/native` APIs.

You can opt in to fallback for missing non-core APIs:

```bash
export BUNLET_CEF_ENABLE_NATIVE_FALLBACK=1
```
