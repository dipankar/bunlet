#!/usr/bin/env bun
/**
 * bunlet doctor - Verify your development environment
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const root = path.resolve(import.meta.dir, '..');

type CheckResult = { pass: boolean; detail: string; level?: 'error' | 'warn' | 'info' };
const checks: Array<CheckResult & { name: string }> = [];

function check(name: string, fn: () => CheckResult) {
  try {
    const result = fn();
    checks.push({ name, ...result });
  } catch (e) {
    checks.push({ name, pass: false, detail: String((e as Error).message) });
  }
}

function which(cmd: string): string | null {
  try {
    return execSync(`command -v ${cmd}`, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null;
  } catch {
    return null;
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

check('C/C++ build toolchain', () => {
  if (process.platform === 'darwin') {
    try {
      const out = execSync('xcode-select -p', { encoding: 'utf-8' }).trim();
      if (!out || !fs.existsSync(out)) {
        return { pass: false, detail: 'Run: xcode-select --install' };
      }
      return { pass: true, detail: `Xcode CLT at ${out}` };
    } catch {
      return { pass: false, detail: 'Xcode CLT missing. Run: xcode-select --install' };
    }
  }
  if (process.platform === 'win32') {
    const link = which('link');
    const cl = which('cl');
    if (cl || link) {
      return { pass: true, detail: `MSVC toolchain found (${cl || link})` };
    }
    return { pass: false, detail: 'MSVC toolchain not on PATH. Install Visual Studio Build Tools with C++ workload.' };
  }
  const cc = which('cc') || which('gcc') || which('clang');
  if (!cc) return { pass: false, detail: 'No C compiler on PATH. Install build-essential or clang.' };
  return { pass: true, detail: `C compiler: ${cc}` };
});

check('Windows WebView2 runtime', () => {
  if (process.platform !== 'win32') {
    return { pass: true, detail: 'n/a (not Windows)', level: 'info' };
  }
  const clientId = '{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}';
  const regPaths = [
    `HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\EdgeUpdate\\Clients\\${clientId}`,
    `HKLM\\SOFTWARE\\Microsoft\\EdgeUpdate\\Clients\\${clientId}`,
    `HKCU\\SOFTWARE\\Microsoft\\EdgeUpdate\\Clients\\${clientId}`,
  ];
  for (const rp of regPaths) {
    try {
      const out = execSync(`reg query "${rp}" /v pv`, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      const m = out.match(/pv\s+REG_SZ\s+([\d.]+)/i);
      if (m) return { pass: true, detail: `WebView2 runtime v${m[1]}` };
    } catch {}
  }
  const pf86 = process.env['ProgramFiles(x86)'];
  if (pf86) {
    const dir = path.join(pf86, 'Microsoft', 'EdgeWebView', 'Application');
    if (fs.existsSync(dir)) return { pass: true, detail: `WebView2 found at ${dir}` };
  }
  return { pass: false, detail: 'WebView2 runtime not detected. Install from https://go.microsoft.com/fwlink/p/?LinkId=2124703' };
});

check('Linux xvfb (headless display)', () => {
  if (process.platform !== 'linux') {
    return { pass: true, detail: 'n/a (not Linux)', level: 'info' };
  }
  if (which('xvfb-run')) return { pass: true, detail: 'xvfb-run available', level: 'info' };
  return { pass: true, detail: 'xvfb-run not installed (only needed for headless CI). Install: sudo apt install xvfb', level: 'warn' };
});

check('CEF native addon', () => {
  const dir = path.join(root, 'packages', 'bunlet-cef');
  if (!fs.existsSync(dir)) return { pass: true, detail: 'CEF package not present', level: 'info' };
  const files = fs.readdirSync(dir).filter((f) => f.match(/^bunlet-cef\..*\.node$/));
  if (files.length === 0) {
    return { pass: true, detail: 'CEF backend not built (optional). Build: cd packages/bunlet-cef && bun run build', level: 'info' };
  }
  return { pass: true, detail: `${files[0]}`, level: 'info' };
});

check('Disk space', () => {
  try {
    const out = execSync(`df -k "${root}" | tail -1`, { encoding: 'utf-8' }).trim();
    const cols = out.split(/\s+/);
    const availKB = parseInt(cols[3], 10);
    if (!Number.isFinite(availKB)) return { pass: true, detail: `df output unrecognized: ${out}`, level: 'info' };
    const availMB = Math.floor(availKB / 1024);
    if (availMB < 2048) {
      return { pass: true, detail: `${availMB} MB free — builds may fail (CEF needs ~6 GB). Set CARGO_TARGET_DIR to a roomier volume.`, level: 'warn' };
    }
    return { pass: true, detail: `${Math.floor(availMB / 1024)} GB free` };
  } catch (e) {
    return { pass: true, detail: 'df unavailable', level: 'info' };
  }
});

console.log('\n  Bunlet Doctor - Environment Check\n');
console.log('  ──────────────────────────────────\n');

for (const c of checks) {
  let icon = '✓';
  let color = '\x1b[32m';
  if (!c.pass) {
    icon = '✗';
    color = '\x1b[31m';
  } else if (c.level === 'warn') {
    icon = '!';
    color = '\x1b[33m';
  } else if (c.level === 'info') {
    icon = 'i';
    color = '\x1b[36m';
  }
  console.log(`  ${color}${icon}\x1b[0m  ${c.name}`);
  console.log(`     ${c.detail}`);
}

const failures = checks.filter((c) => !c.pass);
const warnings = checks.filter((c) => c.pass && c.level === 'warn');
console.log('\n  ──────────────────────────────────\n');

if (failures.length === 0) {
  if (warnings.length > 0) {
    console.log(`  \x1b[32mAll required checks passed\x1b[0m (with ${warnings.length} warning${warnings.length > 1 ? 's' : ''}).\n`);
  } else {
    console.log('  \x1b[32mAll checks passed!\x1b[0m Your environment is ready.\n');
  }
  console.log('  Try running: cd examples/hello-world && bun run main.ts\n');
} else {
  console.log(`  \x1b[31m${failures.length} check(s) failed.\x1b[0m Fix the issues above, then run: bun run doctor\n`);
  process.exit(1);
}