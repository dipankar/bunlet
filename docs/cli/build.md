# bunlet build

Build the application for production.

## Usage

```bash
bunlet build [options]
```

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `--target, -t` | Current OS | Target platform (win32, darwin, linux, all) |
| `--arch, -a` | Current arch | Architecture (x64, arm64, universal) |
| `--outdir, -o` | `./dist` | Output directory |
| `--minify` | `true` | Minify JavaScript output |
| `--sourcemap` | `false` | Generate source maps |
| `--bytecode` | `false` | Pre-compile to bytecode |
| `--analyze` | `false` | Show bundle analysis |

### Size Optimization Options

| Option | Description |
|--------|-------------|
| `--strip-symbols` | Remove debug symbols from native code |
| `--compress` | Apply UPX compression to executable |
| `--tree-shake` | Aggressive tree shaking |

## Output Structure

```
dist/
├── main.js              # Bundled main process
├── preload.js           # Bundled preload script
├── renderer/            # Bundled frontend
│   ├── index.html
│   ├── assets/
│   │   ├── index-[hash].js
│   │   └── index-[hash].css
│   └── ...
├── native/              # Native addons (per platform)
│   ├── darwin-arm64/
│   │   └── bunlet.darwin-arm64.node
│   ├── darwin-x64/
│   ├── win32-x64/
│   └── linux-x64/
└── resources/           # Static resources
    ├── icon.icns
    ├── icon.ico
    └── icons/
```

## Examples

### Basic Build

```bash
bunlet build
```

Builds for current platform and architecture.

### Cross-Platform Build

```bash
# Build for all platforms
bunlet build --target all

# Build for specific platform
bunlet build --target darwin
bunlet build --target win32
bunlet build --target linux
```

### macOS Universal Binary

```bash
bunlet build --target darwin --arch universal
```

Creates a fat binary supporting both Intel and Apple Silicon.

### With Source Maps

```bash
bunlet build --sourcemap
```

Generates `.map` files for debugging production builds.

### With Bytecode Compilation

```bash
bunlet build --bytecode
```

Pre-compiles JavaScript to Bun bytecode for faster startup.

### Bundle Analysis

```bash
bunlet build --analyze
```

Opens an interactive visualization of bundle composition.

## Size Optimization

### Minification (Default)

```bash
bunlet build --minify
```

Removes whitespace, shortens variable names, and eliminates dead code.

**Impact**: -30% to -50% on JavaScript bundle size.

### Debug Symbol Stripping

```bash
bunlet build --strip-symbols
```

Removes debug symbols from native binaries.

**Impact**: -10% to -20% on native addon size.

### UPX Compression

```bash
bunlet build --compress
```

Applies UPX compression to the final executable.

**Impact**: -30% to -50% on executable size.
**Trade-off**: Slightly slower startup (decompression).

### Aggressive Tree Shaking

```bash
bunlet build --tree-shake
```

Enables more aggressive dead code elimination.

**Impact**: Varies based on dependencies.
**Trade-off**: May remove code with side effects.

### Combined Optimizations

```bash
bunlet build --minify --strip-symbols --bytecode --tree-shake
```

For smallest possible output.

## Configuration

Build options in `bunlet.config.ts`:

```typescript
export default defineConfig({
  build: {
    outDir: './dist',
    minify: true,
    sourcemap: false,
    bytecode: true,

    // External modules (not bundled)
    external: ['fsevents'],

    // Define compile-time constants
    define: {
      'process.env.API_URL': JSON.stringify('https://api.example.com'),
    },

    // Babel/SWC transforms
    target: 'esnext',
  },
});
```

## Build Targets

### Native Addon Builds

Native addons are built for each target platform:

```bash
# Builds native addon for darwin-arm64
bunlet build --target darwin --arch arm64
```

Prebuilt binaries are included in the output.

### Cross-Compilation

Building for a different OS requires that OS's toolchain:

```bash
# On macOS, building for Linux requires Docker
bunlet build --target linux --docker

# On any OS, use CI for cross-platform builds
```

## Environment Variables

Build-time variables:

```typescript
// Available in build
process.env.NODE_ENV     // 'production'
process.env.BUNLET_BUILD // 'true'
```

Define custom variables:

```typescript
// bunlet.config.ts
export default defineConfig({
  build: {
    define: {
      __VERSION__: JSON.stringify('1.0.0'),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },
  },
});
```

## Verification

After building:

```bash
# Check output size
du -sh dist/

# Test the build locally
bunlet preview

# Or run directly
bun dist/main.js
```

## CI/CD Integration

### GitHub Actions

```yaml
jobs:
  build:
    strategy:
      matrix:
        os: [macos-latest, windows-latest, ubuntu-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bunlet build
```

### GitLab CI

```yaml
build:
  image: oven/bun
  script:
    - bun install
    - bunlet build
  artifacts:
    paths:
      - dist/
```

## Troubleshooting

### Build Fails with Native Module

```bash
# Ensure native dependencies are installed
bun install

# Rebuild native modules
bun rebuild
```

### Out of Memory

```bash
# Increase Node.js memory
NODE_OPTIONS="--max-old-space-size=4096" bunlet build
```

### Source Maps Too Large

```bash
# Use hidden source maps
bunlet build --sourcemap=hidden
```

## Related

- [Size Optimization](../packaging/size-optimization.md)
- [bunlet package](package.md)
- [Configuration](../getting-started/configuration.md)
