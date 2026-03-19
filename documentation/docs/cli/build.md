# bunlet build

Build the application for production.

## Usage

```bash
bunlet build [options]
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `-o, --outdir <path>` | Output directory | `dist` |
| `--minify` | Minify output | `true` |
| `--sourcemap` | Generate sourcemaps | `false` |

## What It Does

1. **Bundles renderer code** - Compiles and optimizes frontend assets
2. **Bundles main process** - Compiles TypeScript to JavaScript
3. **Copies static assets** - Moves images, fonts, etc.
4. **Optimizes for production** - Minification, tree-shaking

## Output Structure

```
dist/
├── main/
│   └── index.js          # Main process bundle
├── renderer/
│   ├── index.html
│   ├── assets/
│   │   ├── index-[hash].js
│   │   └── index-[hash].css
│   └── ...
└── package.json
```

## Examples

### Basic Build

```bash
bunlet build
```

### Custom Output Directory

```bash
bunlet build --outdir out
```

### With Sourcemaps

```bash
bunlet build --sourcemap
```

### Without Minification

```bash
bunlet build --minify false
```

## Environment Variables

Production build sets:

```typescript
process.env.NODE_ENV = 'production';
```

## Configuration

Configure build in `bunlet.config.ts`:

```typescript
export default {
  build: {
    outdir: 'dist',
    minify: true,
    sourcemap: false,
    target: 'esnext',
  },
};
```

## Build Optimization

### Code Splitting

Large apps automatically split into chunks:

```typescript
// Dynamic import creates separate chunk
const module = await import('./heavy-module');
```

### Tree Shaking

Unused exports are removed:

```typescript
// Only used functions are included
import { usedFunction } from './utils';
```

### Asset Optimization

- Images are optimized
- CSS is minified
- HTML is minified

## Testing the Build

Run the production build locally:

```bash
bunlet build
cd dist
bun run main/index.js
```

## Next Steps

After building, package for distribution:

```bash
bunlet package
```
