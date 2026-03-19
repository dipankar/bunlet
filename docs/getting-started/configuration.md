# Configuration

Bunlet apps are configured via `bunlet.config.ts` in the project root.

## Basic Configuration

```typescript
// bunlet.config.ts
import { defineConfig } from 'bunlet/config';

export default defineConfig({
  // Required: Unique app identifier
  appId: 'com.example.myapp',

  // Required: Display name
  productName: 'My App',

  // Required: Version (semver)
  version: '1.0.0',

  // Entry points
  main: './src/main.ts',
  preload: './src/preload.ts',
  renderer: {
    entry: './src/renderer/index.html',
  },
});
```

## Full Configuration Reference

```typescript
import { defineConfig } from 'bunlet/config';

export default defineConfig({
  // ============================================
  // APP METADATA
  // ============================================

  // Unique identifier (reverse domain)
  appId: 'com.example.myapp',

  // Display name shown to users
  productName: 'My App',

  // App version (semver format)
  version: '1.0.0',

  // Build number (optional, for app stores)
  buildNumber: '100',

  // Copyright notice
  copyright: 'Copyright 2026 Your Company',

  // ============================================
  // ENTRY POINTS
  // ============================================

  // Main process entry
  main: './src/main.ts',

  // Preload script (optional)
  preload: './src/preload.ts',

  // Renderer entry
  renderer: {
    // HTML entry point
    entry: './src/renderer/index.html',

    // Or for SPA frameworks:
    // entry: './src/renderer/main.tsx',
    // template: './src/renderer/index.html',
  },

  // ============================================
  // WEBVIEW ENGINE
  // ============================================

  webview: {
    // Engine: 'system' (default) or 'cef'
    engine: 'system',

    // CEF-specific options
    cef: {
      cachePath: './cef-cache',
      remoteDebuggingPort: 9222,
      disableGpu: false,
    },
  },

  // ============================================
  // DEFAULT WINDOW OPTIONS
  // ============================================

  window: {
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    maxWidth: undefined,
    maxHeight: undefined,

    // Frame and appearance
    frame: true,
    transparent: false,
    titleBarStyle: 'default', // 'hidden', 'hiddenInset'

    // macOS vibrancy
    vibrancy: undefined,

    // Windows 11 material
    backgroundMaterial: undefined, // 'mica', 'acrylic'
  },

  // ============================================
  // BUILD OPTIONS
  // ============================================

  build: {
    // Output directory
    outDir: './dist',

    // Minify output
    minify: true,

    // Generate source maps
    sourcemap: false,

    // Pre-compile to bytecode (faster startup)
    bytecode: false,

    // External modules (not bundled)
    external: [],

    // Environment variables to embed
    define: {
      'process.env.API_URL': JSON.stringify('https://api.example.com'),
    },
  },

  // ============================================
  // MACOS OPTIONS
  // ============================================

  mac: {
    // App icon (icns format)
    icon: './resources/icon.icns',

    // App category
    category: 'public.app-category.developer-tools',

    // Dark mode support
    darkModeSupport: true,

    // Code signing
    identity: undefined, // Auto-detect from keychain
    hardenedRuntime: true,
    entitlements: './build/entitlements.mac.plist',
    entitlementsInherit: './build/entitlements.mac.inherit.plist',

    // Notarization
    notarize: {
      teamId: process.env.APPLE_TEAM_ID,
    },

    // DMG options
    dmg: {
      background: './build/dmg-background.png',
      iconSize: 128,
      contents: [
        { x: 380, y: 170, type: 'link', path: '/Applications' },
        { x: 130, y: 170, type: 'file' },
      ],
    },
  },

  // ============================================
  // WINDOWS OPTIONS
  // ============================================

  win: {
    // App icon (ico format)
    icon: './resources/icon.ico',

    // Code signing
    certificateFile: process.env.WIN_CSC_LINK,
    certificatePassword: process.env.WIN_CSC_KEY_PASSWORD,
    // Or use certificate store:
    // certificateSubjectName: 'Your Company',
    // certificateSha1: 'thumbprint',

    // NSIS installer
    nsis: {
      oneClick: false,
      allowToChangeInstallationDirectory: true,
      perMachine: false,
      createDesktopShortcut: true,
      createStartMenuShortcut: true,
    },

    // MSI installer
    msi: {
      createDesktopShortcut: true,
      createStartMenuShortcut: true,
    },
  },

  // ============================================
  // LINUX OPTIONS
  // ============================================

  linux: {
    // Icons directory (multiple sizes)
    icon: './resources/icons',

    // Desktop category
    category: 'Development',

    // MIME types
    mimeTypes: [],

    // Desktop file metadata
    desktop: {
      Name: 'My App',
      Comment: 'My awesome application',
      Keywords: 'app;desktop;',
    },

    // AppImage options
    appImage: {
      artifactName: '${productName}-${version}-${arch}.AppImage',
    },

    // Debian options
    deb: {
      depends: ['libgtk-3-0', 'libnotify4', 'libnss3'],
    },

    // RPM options
    rpm: {
      depends: ['gtk3', 'libnotify', 'nss'],
    },
  },

  // ============================================
  // AUTO-UPDATER
  // ============================================

  updater: {
    // Update server URL
    url: 'https://releases.example.com',

    // Or use a provider
    provider: 'github', // 'github', 's3', 'generic'
    owner: 'your-org',
    repo: 'your-app',

    // Update channel
    channel: 'latest', // 'latest', 'beta', 'alpha'

    // Options
    autoDownload: true,
    autoInstallOnAppQuit: true,
    allowPrerelease: false,
    allowDowngrade: false,
  },

  // ============================================
  // PROTOCOL HANDLERS
  // ============================================

  protocols: [
    {
      name: 'My App Protocol',
      schemes: ['myapp'],
    },
  ],

  // ============================================
  // FILE ASSOCIATIONS
  // ============================================

  fileAssociations: [
    {
      ext: 'myext',
      name: 'My File Type',
      description: 'My App File',
      mimeType: 'application/x-myapp',
      icon: './resources/file-icon.icns',
      role: 'Editor',
    },
  ],

  // ============================================
  // ENVIRONMENT VARIABLES
  // ============================================

  env: {
    NODE_ENV: 'production',
  },

  // ============================================
  // BUILD HOOKS
  // ============================================

  hooks: {
    beforeBuild: async (config) => {
      console.log('Starting build...');
    },
    afterBuild: async (config, artifacts) => {
      console.log('Build complete');
    },
    beforePackage: async (config) => {
      console.log('Starting packaging...');
    },
    afterPackage: async (config, artifacts) => {
      console.log('Packaging complete');
    },
  },
});
```

## Environment Variables

Configuration supports environment variables:

```typescript
export default defineConfig({
  mac: {
    notarize: {
      teamId: process.env.APPLE_TEAM_ID,
    },
  },
  win: {
    certificateFile: process.env.WIN_CSC_LINK,
    certificatePassword: process.env.WIN_CSC_KEY_PASSWORD,
  },
});
```

## Configuration per Environment

```typescript
const isDev = process.env.NODE_ENV === 'development';

export default defineConfig({
  build: {
    minify: !isDev,
    sourcemap: isDev,
  },
});
```

## TypeScript Support

The `defineConfig` helper provides full TypeScript autocompletion:

```typescript
import { defineConfig, type BunletConfig } from 'bunlet/config';

// With type checking
export default defineConfig({
  // Autocomplete available here
});

// Or explicit typing
const config: BunletConfig = {
  // ...
};

export default config;
```

## Related

- [CLI Overview](../cli/overview.md) - Command line options
- [Build Command](../cli/build.md) - Build configuration
- [Package Command](../cli/package.md) - Packaging options
