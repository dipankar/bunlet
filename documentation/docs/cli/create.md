# bunlet create

Create a new Bunlet project with a ready-to-use starter template.

## Usage

```bash
bunlet create <project-name> [options]
```

## Arguments

| Argument | Description |
|----------|-------------|
| `project-name` | Name of the project directory to create |

## Options

| Option | Description |
|--------|-------------|
| `-t, --template <name>` | Project template to use (`default` only) |
| `--no-typescript` | Use JavaScript instead of TypeScript |
| `--webview <engine>` | WebView engine (`system`, `cef`) |
| `--no-git` | Skip git initialization |
| `--no-install` | Skip dependency installation |

## Templates

| Template | Description |
|----------|-------------|
| `default` | Basic starter template |

Additional framework templates are planned but not implemented yet.

## Examples

### Create with Default Template

```bash
bunlet create my-app
```

### Create with CEF runtime mode

```bash
bunlet create my-app --template default --webview cef
```

### Create JavaScript Project

```bash
bunlet create my-app --no-typescript
```

## What Gets Created

```
my-app/
├── src/
│   ├── main.ts           # Main process entry
│   └── renderer/         # Frontend code
│       ├── index.html
│       ├── main.ts
│       └── style.css
├── package.json
├── tsconfig.json
└── bunlet.config.ts
```

## After Creation

```bash
cd my-app
bun install
bun run dev
```

## Interactive Mode

Interactive mode is not implemented yet.
