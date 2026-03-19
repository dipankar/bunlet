# bunlet package

Create distributable installers for your application.

## Usage

```bash
bunlet package [options]
```

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `--target, -t` | Current OS | Target platform |
| `--arch, -a` | Current arch | Target architecture |
| `--format, -f` | Platform default | Installer format(s) |
| `--outdir, -o` | `./release` | Output directory |
| `--sign` | `false` | Code sign the application |
| `--notarize` | `false` | Notarize (macOS only) |
| `--publish` | `false` | Publish to update server |

### Compression Options

| Option | Description |
|--------|-------------|
| `--compression` | Compression type (lzma, zstd, deflate) |
| `--no-asar` | Don't use ASAR archive |

## Installer Formats

### macOS

| Format | Description |
|--------|-------------|
| `dmg` | Disk image with drag-to-install |
| `pkg` | macOS installer package |
| `mas` | Mac App Store package |
| `zip` | ZIP archive |

### Windows

| Format | Description |
|--------|-------------|
| `nsis` | NSIS installer (recommended) |
| `msi` | Windows Installer (enterprise) |
| `portable` | Portable executable |
| `appx` | Microsoft Store package |

### Linux

| Format | Description |
|--------|-------------|
| `appimage` | Universal Linux package |
| `deb` | Debian/Ubuntu package |
| `rpm` | Red Hat/Fedora package |
| `snap` | Snap package |
| `flatpak` | Flatpak package |
| `pacman` | Arch Linux package |

## Examples

### Basic Packaging

```bash
bunlet package
```

Creates installer for current platform with default format.

### Specific Format

```bash
# macOS DMG
bunlet package --format dmg

# Windows NSIS
bunlet package --format nsis

# Linux AppImage
bunlet package --format appimage
```

### Multiple Formats

```bash
bunlet package --format dmg,pkg,zip
bunlet package --format nsis,msi,portable
bunlet package --format appimage,deb,rpm
```

### Cross-Platform

```bash
# All platforms
bunlet package --target all

# Specific platform
bunlet package --target darwin
bunlet package --target win32
bunlet package --target linux
```

### With Code Signing

```bash
# macOS
bunlet package --sign --notarize

# Windows
bunlet package --sign
```

## Output Structure

```
release/
├── My App-1.0.0-darwin-arm64.dmg
├── My App-1.0.0-darwin-x64.dmg
├── My App-1.0.0-darwin-universal.dmg
├── My App-1.0.0-win32-x64-setup.exe
├── My App-1.0.0-win32-x64.msi
├── My App-1.0.0-linux-x64.AppImage
├── my-app_1.0.0_amd64.deb
├── my-app-1.0.0.x86_64.rpm
├── latest-mac.yml              # Update manifest
├── latest.yml                  # Update manifest (Windows)
└── latest-linux.yml            # Update manifest
```

## Code Signing

### macOS

1. **Get certificates** from Apple Developer Program
2. **Install** in Keychain Access
3. **Configure** in bunlet.config.ts:

```typescript
export default defineConfig({
  mac: {
    identity: 'Developer ID Application: Your Name (TEAM_ID)',
    hardenedRuntime: true,
    entitlements: './build/entitlements.mac.plist',
    entitlementsInherit: './build/entitlements.mac.inherit.plist',
  },
});
```

4. **Package with signing**:

```bash
bunlet package --sign
```

### macOS Notarization

Required for distribution outside App Store:

```typescript
export default defineConfig({
  mac: {
    notarize: {
      teamId: process.env.APPLE_TEAM_ID,
    },
  },
});
```

Set environment variables:
```bash
export APPLE_ID="your@email.com"
export APPLE_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="ABCD1234"
```

Package:
```bash
bunlet package --sign --notarize
```

### Windows

1. **Get certificate** from CA or self-sign for testing
2. **Configure** in bunlet.config.ts:

```typescript
export default defineConfig({
  win: {
    certificateFile: process.env.WIN_CSC_LINK,
    certificatePassword: process.env.WIN_CSC_KEY_PASSWORD,
  },
});
```

3. **Package**:

```bash
WIN_CSC_LINK=/path/to/cert.pfx \
WIN_CSC_KEY_PASSWORD=password \
bunlet package --sign
```

## Size Optimization

### Compression Levels

```bash
# LZMA (smallest, slowest install)
bunlet package --compression lzma

# Zstandard (balanced)
bunlet package --compression zstd

# Deflate (fastest install)
bunlet package --compression deflate
```

### Expected Sizes

| Component | Uncompressed | LZMA |
|-----------|--------------|------|
| Bun runtime | 50-90MB | 20-30MB |
| Native addon | 3-5MB | 1-2MB |
| App code | 5-10MB | 2-4MB |
| **Total** | **60-105MB** | **25-40MB** |

### Aggressive Optimization

```bash
bunlet build --minify --strip-symbols --bytecode
bunlet package --compression lzma
```

Target: **15-25MB** installer.

## Configuration

Full packaging options:

```typescript
export default defineConfig({
  mac: {
    icon: './resources/icon.icns',
    category: 'public.app-category.developer-tools',
    dmg: {
      background: './build/dmg-background.png',
      iconSize: 128,
      contents: [
        { x: 380, y: 170, type: 'link', path: '/Applications' },
        { x: 130, y: 170, type: 'file' },
      ],
    },
  },

  win: {
    icon: './resources/icon.ico',
    nsis: {
      oneClick: false,
      allowToChangeInstallationDirectory: true,
      createDesktopShortcut: true,
      createStartMenuShortcut: true,
    },
  },

  linux: {
    icon: './resources/icons',
    category: 'Development',
    deb: {
      depends: ['libgtk-3-0', 'libnotify4'],
    },
  },
});
```

## Publishing

### To GitHub Releases

```bash
# Configure in bunlet.config.ts
export default defineConfig({
  updater: {
    provider: 'github',
    owner: 'your-org',
    repo: 'your-app',
  },
});

# Package and publish
GH_TOKEN=your_token bunlet package --publish
```

### To S3

```bash
export default defineConfig({
  updater: {
    provider: 's3',
    bucket: 'your-bucket',
    region: 'us-east-1',
  },
});

AWS_ACCESS_KEY_ID=xxx \
AWS_SECRET_ACCESS_KEY=xxx \
bunlet package --publish
```

## CI/CD

### GitHub Actions

```yaml
name: Release
on:
  push:
    tags: ['v*']

jobs:
  release:
    strategy:
      matrix:
        os: [macos-latest, windows-latest, ubuntu-latest]
    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1

      - run: bun install
      - run: bunlet build

      - name: Package (macOS)
        if: matrix.os == 'macos-latest'
        env:
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
          CSC_LINK: ${{ secrets.MAC_CERT }}
          CSC_KEY_PASSWORD: ${{ secrets.MAC_CERT_PASSWORD }}
        run: bunlet package --sign --notarize

      - name: Package (Windows)
        if: matrix.os == 'windows-latest'
        env:
          WIN_CSC_LINK: ${{ secrets.WIN_CERT }}
          WIN_CSC_KEY_PASSWORD: ${{ secrets.WIN_CERT_PASSWORD }}
        run: bunlet package --sign

      - name: Package (Linux)
        if: matrix.os == 'ubuntu-latest'
        run: bunlet package

      - uses: softprops/action-gh-release@v1
        with:
          files: release/*
```

## Troubleshooting

### DMG Background Not Showing

Ensure image is exactly 540x380 pixels and in PNG format.

### NSIS "Can't find installer"

Install NSIS:
```bash
# macOS
brew install nsis

# Ubuntu
sudo apt install nsis

# Windows
choco install nsis
```

### Code Signing Fails

```bash
# macOS: Check certificate
security find-identity -v -p codesigning

# Windows: Verify certificate
signtool verify /pa app.exe
```

## Related

- [Size Optimization](../packaging/size-optimization.md)
- [Code Signing](../packaging/code-signing.md)
- [Auto-Updates](../packaging/auto-updates.md)
- [bunlet build](build.md)
