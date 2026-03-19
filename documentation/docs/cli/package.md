# bunlet package

Package the application for distribution.

## Usage

```bash
bunlet package [options]
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--platform <platform>` | Target platform | Current platform |
| `--arch <arch>` | Target architecture | Current arch |
| `-o, --outdir <path>` | Output directory | `release` |
| `--no-sign` | Skip code signing | - |

## Platforms

| Platform | Value | Output |
|----------|-------|--------|
| macOS | `darwin` | `.app`, `.dmg` |
| Windows | `win32` | `.exe`, `.msi` |
| Linux | `linux` | `.AppImage`, `.deb`, `.rpm` |

## Architectures

| Architecture | Value |
|--------------|-------|
| Intel/AMD 64-bit | `x64` |
| Apple Silicon | `arm64` |

## Examples

### Package for Current Platform

```bash
bunlet package
```

### Package for macOS

```bash
bunlet package --platform darwin
```

### Package for Windows

```bash
bunlet package --platform win32 --arch x64
```

### Package for Linux

```bash
bunlet package --platform linux
```

### Specify Output Directory

```bash
bunlet package --outdir ./releases
```

## Output Structure

```
release/
├── mac/
│   ├── MyApp.app/
│   └── MyApp-1.0.0.dmg
├── win/
│   ├── MyApp.exe
│   └── MyApp-1.0.0-setup.exe
└── linux/
    ├── MyApp.AppImage
    └── myapp_1.0.0_amd64.deb
```

## Configuration

Configure packaging in `bunlet.config.ts`:

```typescript
export default {
  package: {
    name: 'MyApp',
    productName: 'My Application',
    version: '1.0.0',
    description: 'A desktop application built with Bunlet',
    author: 'Your Name <you@example.com>',

    // App icons
    icon: {
      mac: 'assets/icon.icns',
      win: 'assets/icon.ico',
      linux: 'assets/icon.png',
    },

    // macOS specific
    mac: {
      category: 'public.app-category.developer-tools',
      bundleId: 'com.example.myapp',
    },

    // Windows specific
    win: {
      // Certificate for signing
    },

    // Linux specific
    linux: {
      category: 'Development',
      maintainer: 'Your Name <you@example.com>',
    },
  },
};
```

## Code Signing

### macOS

Requires Apple Developer certificate:

```bash
export APPLE_ID="your@email.com"
export APPLE_ID_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="XXXXXXXXXX"

bunlet package --platform darwin
```

### Windows

Requires code signing certificate:

```bash
export WIN_CSC_LINK="path/to/certificate.pfx"
export WIN_CSC_KEY_PASSWORD="password"

bunlet package --platform win32
```

### Skip Signing

For testing without certificates:

```bash
bunlet package --no-sign
```

## App Icons

Prepare icons in multiple sizes:

| Platform | Format | Sizes |
|----------|--------|-------|
| macOS | `.icns` | 16-1024px |
| Windows | `.ico` | 16-256px |
| Linux | `.png` | 512px |

## File Associations

Register file types in config:

```typescript
export default {
  package: {
    fileAssociations: [
      {
        ext: 'myfile',
        name: 'My File Type',
        description: 'My Application File',
        icon: 'assets/file-icon.png',
      },
    ],
  },
};
```

## Troubleshooting

### Build Fails

Run build first:

```bash
bunlet build
bunlet package
```

### Missing Dependencies

Ensure native dependencies are rebuilt:

```bash
bun install
bunlet build
bunlet package
```

### Large Package Size

Check for unnecessary files in `dist/`. Add to `.bunletignore`:

```
node_modules/
*.map
*.md
```
