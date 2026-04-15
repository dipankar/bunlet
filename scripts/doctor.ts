#!/usr/bin/env bun
/**
 * bunlet doctor - Verify your development environment
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const root = path.resolve(import.meta.dir, '..');
const checks: Array<{ name: string; pass: boolean; detail: string }> = [];

function check(name: string, fn: () => { pass: boolean; detail: string }) {
  try {
    const result = fn();
    checks.push({ name, ...result });
  } catch (e) {
    checks.push({ name, pass: false, detail: String((e as Error).message) });
  }
}

check('Bun runtime', () => {
  const version = typeof Bun !== 'undefined' ? Bun.version : 'not found';
  return { pass: typeof Bun !== 'undefined', detail: `Bun ${version}` };
});

check('Rust toolchain', () => {
  const out = execSync('rustc --version', { encoding: 'utf-8' }).trim();
  return { pass: true, detail: out };
});

check('Cargo build system', () => {
  const out = execSync('cargo --version', { encoding: 'utf-8' }).trim();
  return { pass: true, detail: out };
});

check('Node modules installed', () => {
  const exists = fs.existsSync(path.join(root, 'node_modules'));
  return { pass: exists, detail: exists ? 'node_modules/ exists' : 'Run: bun install' };
});

check('Native module built', () => {
  const pattern = 'bunlet-native.*.node';
  const dir = path.join(root, 'packages', 'bunlet-native');
  const files = fs.readdirSync(dir).filter(f => f.match(/^bunlet-native\..*\.node$/));
  if (files.length === 0) {
    return { pass: false, detail: 'Run: bun run build:native' };
  }
  return { pass: true, detail: files[0] };
});

check('Bunlet JS package built', () => {
  const exists = fs.existsSync(path.join(root, 'packages', 'bunlet', 'dist', 'index.js'));
  return { pass: exists, detail: exists ? 'dist/index.js exists' : 'Run: bun run build:packages' };
});

check('CLI built', () => {
  const exists = fs.existsSync(path.join(root, 'packages', 'bunlet-cli', 'dist', 'cli.js'));
  return { pass: exists, detail: exists ? 'dist/cli.js exists' : 'Run: bun run build:packages' };
});

check('hello-world example files', () => {
  const main = path.join(root, 'examples', 'hello-world', 'main.ts');
  const html = path.join(root, 'examples', 'hello-world', 'index.html');
  const ok = fs.existsSync(main) && fs.existsSync(html);
  return { pass: ok, detail: ok ? 'All files present' : 'Missing files' };
});

check('Platform-specific libraries', () => {
  if (process.platform === 'linux') {
    try {
      const webkit = execSync('pkg-config --exists webkit2gtk-4.1 2>&1 || echo missing', { encoding: 'utf-8' }).trim();
      const gtk = execSync('pkg-config --exists gtk+-3.0 2>&1 || echo missing', { encoding: 'utf-8' }).trim();
      if (webkit.includes('missing') || gtk.includes('missing')) {
        return { pass: false, detail: 'Missing webkit2gtk-4.1 or gtk+-3.0. See docs/getting-started/installation.md' };
      }
      return { pass: true, detail: 'webkit2gtk-4.1 and gtk+-3.0 found' };
    } catch {
      return { pass: false, detail: 'pkg-config not available. Install platform dev libraries.' };
    }
  }
  return { pass: true, detail: `macOS/Windows: native libraries bundled` };
});

console.log('\n  Bunlet Doctor - Environment Check\n');
console.log('  ──────────────────────────────────\n');

for (const c of checks) {
  const icon = c.pass ? '✓' : '✗';
  const color = c.pass ? '\x1b[32m' : '\x1b[31m';
  console.log(`  ${color}${icon}\x1b[0m  ${c.name}`);
  console.log(`     ${c.detail}`);
}

const failures = checks.filter(c => !c.pass);
console.log('\n  ──────────────────────────────────\n');

if (failures.length === 0) {
  console.log('  \x1b[32mAll checks passed!\x1b[0m Your environment is ready.\n');
  console.log('  Try running: cd examples/hello-world && bun run main.ts\n');
} else {
  console.log(`  \x1b[31m${failures.length} check(s) failed.\x1b[0m Fix the issues above, then run: bun run doctor\n`);
  process.exit(1);
}