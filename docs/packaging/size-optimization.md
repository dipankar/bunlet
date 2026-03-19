# Size Optimization Guide

This guide covers strategies to minimize Bunlet application size for production releases.

## Size Targets

| Build Type | Installer Size | Description |
|------------|----------------|-------------|
| Standard | 25-40MB | Default optimizations |
| Optimized | 18-25MB | Recommended for production |
| Aggressive | 12-18MB | Maximum compression, trade-offs |

### Component Breakdown

| Component | Unoptimized | Optimized | Aggressive |
|-----------|-------------|-----------|------------|
| Bun runtime | 50-90MB | 25-35MB | 15-20MB |
| Native addon | 5-8MB | 2-4MB | 1-2MB |
| App code | 5-20MB | 2-8MB | 1-4MB |
| Resources | 1-10MB | 0.5-5MB | 0.2-2MB |

## Optimization Strategies

### 1. Bun Runtime Optimization

#### Single Executable Compilation

```bash
bunlet build --compile
```

Bundles your app into a single executable with the Bun runtime.

#### Bytecode Compilation

```bash
bunlet build --bytecode
```

Pre-compiles JavaScript to Bun's bytecode format:
- **Benefit**: Faster startup (skips parsing)
- **Savings**: ~10% smaller (no source text)

#### Minification

```bash
bunlet build --minify
```

Enabled by default. Removes whitespace, shortens names, eliminates dead code.

### 2. Native Addon Optimization

#### Strip Debug Symbols

```bash
bunlet build --strip-symbols
```

Removes debug information from native binaries:
- **macOS**: `strip -x`
- **Linux**: `strip --strip-unneeded`
- **Windows**: `/DEBUG:NONE`

**Savings**: 10-20% on native code

#### Release Build

Ensure Rust builds use release profile:

```toml
# Cargo.toml
[profile.release]
lto = true           # Link-time optimization
codegen-units = 1    # Better optimization
panic = "abort"      # Smaller binary
strip = true         # Strip symbols
opt-level = "z"      # Optimize for size
```

### 3. JavaScript Bundle Optimization

#### Tree Shaking

```bash
bunlet build --tree-shake
```

Eliminates unused exports from dependencies:

```typescript
// Bad: Imports entire library
import _ from 'lodash';

// Good: Import only what you use
import debounce from 'lodash/debounce';
```

#### Dead Code Elimination

Bunlet automatically removes:
- Unused functions and variables
- Unreachable code paths
- Development-only code (`if (process.env.NODE_ENV === 'development')`)

#### Code Splitting

For large apps, split renderer code:

```typescript
// bunlet.config.ts
export default defineConfig({
  build: {
    splitting: true,
    chunkSizeLimit: 500, // KB
  },
});
```

### 4. Dependency Audit

#### Analyze Bundle

```bash
bunlet build --analyze
```

Opens interactive visualization showing:
- Which dependencies are largest
- Duplicate code
- Unused exports

#### Remove Unused Dependencies

```bash
# Find unused dependencies
npx depcheck

# Remove them
bun remove unused-package
```

#### Use Lighter Alternatives

| Heavy Library | Lighter Alternative | Savings |
|---------------|---------------------|---------|
| `moment` | `dayjs` | ~60KB |
| `lodash` | `lodash-es` or native | ~70KB |
| `axios` | `ky` or `fetch` | ~15KB |
| `uuid` | `nanoid` | ~10KB |

#### Avoid Polyfills

Bunlet targets modern engines. Avoid polyfills for:
- `Promise`, `async/await`
- `Array.prototype` methods
- `Object.assign`, spread operator
- `fetch` API

### 5. Asset Optimization

#### Image Compression

```bash
# Install imagemin
bun add -D imagemin-cli

# Compress images
imagemin resources/*.png --out-dir=dist/resources
```

Use modern formats:
- **WebP**: 30% smaller than PNG/JPEG
- **AVIF**: 50% smaller (limited browser support)

#### Font Subsetting

Include only used characters:

```bash
# Using fonttools
pyftsubset font.ttf --text="$(cat index.html)" --output-file=font-subset.woff2
```

#### SVG Optimization

```bash
# Using svgo
npx svgo -r resources/icons
```

### 6. Compression

#### Installer Compression

```bash
# LZMA (smallest, ~30-40% reduction)
bunlet package --compression lzma

# Zstandard (balanced, ~25-35% reduction)
bunlet package --compression zstd

# Deflate (fastest, ~20-30% reduction)
bunlet package --compression deflate
```

#### UPX Executable Compression

```bash
bunlet build --compress
```

Applies UPX compression:
- **Savings**: 30-50%
- **Trade-off**: Slower startup (decompression)

### 7. Platform-Specific

#### macOS Universal Binary

```bash
# Universal (x64 + arm64)
bunlet package --arch universal
# Size: ~2x single arch

# Single architecture
bunlet package --arch arm64
# Size: 1x (recommended if targeting only Apple Silicon)
```

#### Windows

Remove unnecessary runtime components:

```typescript
// bunlet.config.ts
export default defineConfig({
  win: {
    // Don't include debug runtime
    includeDebugSymbols: false,
  },
});
```

#### Linux

Link against system libraries:

```typescript
// bunlet.config.ts
export default defineConfig({
  linux: {
    // Use system WebKitGTK (smaller AppImage)
    systemWebKit: true,
  },
});
```

## Optimization Profiles

### Standard (Default)

```bash
bunlet build
bunlet package
```

```typescript
// bunlet.config.ts
export default defineConfig({
  build: {
    minify: true,
    sourcemap: false,
  },
});
```

**Result**: 25-40MB

### Production Optimized

```bash
bunlet build --minify --bytecode --strip-symbols
bunlet package --compression lzma
```

```typescript
export default defineConfig({
  build: {
    minify: true,
    bytecode: true,
    sourcemap: false,
    external: ['fsevents'], // Platform-specific
  },
});
```

**Result**: 18-25MB

### Maximum Compression

```bash
bunlet build --minify --bytecode --strip-symbols --tree-shake --compress
bunlet package --compression lzma
```

```typescript
export default defineConfig({
  build: {
    minify: true,
    bytecode: true,
    stripSymbols: true,
    treeShake: 'aggressive',
    compress: true,
  },
});
```

**Trade-offs**:
- Slower startup (UPX decompression)
- May break some dynamic imports
- Harder to debug

**Result**: 12-18MB

## Measuring Size

### Build Size

```bash
# Check output size
du -sh dist/

# Detailed breakdown
du -sh dist/*
```

### Bundle Analysis

```bash
# Visual analysis
bunlet build --analyze

# JSON report
bunlet build --stats=stats.json
```

### Installer Size

```bash
# Final installer size
ls -lh release/

# Compare formats
ls -lh release/*.dmg release/*.zip
```

## Size Budget Enforcement

Add size checks to CI:

```yaml
# .github/workflows/build.yml
- name: Check bundle size
  run: |
    SIZE=$(du -sb dist/ | cut -f1)
    MAX_SIZE=30000000  # 30MB
    if [ $SIZE -gt $MAX_SIZE ]; then
      echo "Bundle size $SIZE exceeds limit $MAX_SIZE"
      exit 1
    fi
```

## Comparison: Bunlet vs Others

| Framework | Typical Size | Notes |
|-----------|--------------|-------|
| **Bunlet (System WebView)** | 20-40MB | Includes Bun runtime |
| **Bunlet (CEF)** | 100-140MB | Includes Chromium |
| Tauri | 2-10MB | No runtime (Rust) |
| Electron | 80-150MB | Includes Chromium + Node |
| NW.js | 100-200MB | Includes Chromium + Node |
| Neutralino | 2-5MB | System browser |

## Troubleshooting

### Bundle Larger Than Expected

1. **Check for duplicate dependencies**
   ```bash
   bunlet build --analyze
   ```

2. **Look for bundled devDependencies**
   ```bash
   bunlet build --verbose
   ```

3. **Verify tree shaking**
   ```bash
   bunlet build --tree-shake --verbose
   ```

### Compression Not Working

1. **UPX not installed**
   ```bash
   # macOS
   brew install upx

   # Ubuntu
   sudo apt install upx
   ```

2. **Binary already compressed**
   - Some binaries can't be compressed further
   - UPX may increase size for already-optimized binaries

### Native Addon Too Large

1. **Check Rust optimization**
   ```toml
   # Cargo.toml
   [profile.release]
   opt-level = "z"
   lto = true
   ```

2. **Strip symbols manually**
   ```bash
   strip -x native.node
   ```

## Related

- [bunlet build](../cli/build.md)
- [bunlet package](../cli/package.md)
- [Performance Guide](../advanced/performance.md)
