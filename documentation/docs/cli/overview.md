# CLI Overview

The Bunlet CLI provides commands for creating, developing, building, and packaging desktop applications.

## Installation

```bash
npm install -g bunlet-cli
# or
bun install -g bunlet-cli
```

## Commands

| Command | Description |
|---------|-------------|
| `bunlet create` | Create a new Bunlet project |
| `bunlet dev` | Start development server |
| `bunlet build` | Build for production |
| `bunlet package` | Package as distributable |

## Usage

```bash
bunlet <command> [options]
```

### Global Options

| Option | Description |
|--------|-------------|
| `-h, --help` | Show help |
| `-v, --version` | Show version |

## Quick Reference

### Create a New Project

```bash
bunlet create my-app
cd my-app
bun install
```

### Development

```bash
bunlet dev
```

### Production Build

```bash
bunlet build
```

### Package for Distribution

```bash
bunlet package
```

## Project Scripts

A typical `package.json` includes:

```json
{
  "scripts": {
    "dev": "bunlet dev",
    "build": "bunlet build",
    "package": "bunlet package"
  }
}
```

Run with:

```bash
bun run dev
bun run build
bun run package
```
