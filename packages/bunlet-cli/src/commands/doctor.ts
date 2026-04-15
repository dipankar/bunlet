#!/usr/bin/env bun
/**
 * Bunlet CLI doctor command
 *
 * Verifies the development environment and prints a diagnostics report.
 */

import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';

export async function doctorCommand() {
  console.log('\n=== Bunlet Doctor ===\n');

  let issues = 0;

  // Check Bun
  try {
    const bunVersion = execSync('bun --version', { encoding: 'utf-8' }).trim();
    console.log(`  [OK]  Bun ${bunVersion}`);
  } catch {
    console.log('  [FAIL] Bun not found. Install from https://bun.sh');
    issues++;
  }

  // Check Rust/Cargo
  try {
    const rustVersion = execSync('rustc --version', { encoding: 'utf-8' }).trim();
    console.log(`  [OK]  ${rustVersion}`);
  } catch {
    console.log('  [FAIL] Rust not found. Install from https://rustup.rs');
    issues++;
  }

  try {
    const cargoVersion = execSync('cargo --version', { encoding: 'utf-8' }).trim();
    console.log(`  [OK]  ${cargoVersion}`);
  } catch {
    console.log('  [FAIL] Cargo not found');
    issues++;
  }

  // Check native module
  const nativePkgPath = join(process.cwd(), 'packages/bunlet-native/package.json');
  if (existsSync(nativePkgPath)) {
    const nativePkg = JSON.parse(readFileSync(nativePkgPath, 'utf-8'));
    console.log(`  [OK]  @bunlet/native v${nativePkg.version}`);
  }

  // Check for .node artifacts
  const nodeArchifacts = [
    'packages/bunlet-native/bunlet.darwin-arm64.node',
    'packages/bunlet-native/bunlet.linux-x64-gnu.node',
    'packages/bunlet-native/bunlet.win32-x64.node',
  ];
  const found = nodeArchifacts.find((p) => existsSync(join(process.cwd(), p)));
  if (found) {
    console.log(`  [OK]  Native module built: ${found.split('/').pop()}`);
  } else {
    console.log('  [WARN] No native .node artifact found. Run: bun run build:native');
    issues++;
  }

  // Check CEF native module
  const cefHelperPath = join(process.cwd(), 'packages/bunlet-cef/bunlet-cef-helper');
  const cefNodePath = join(process.cwd(), 'packages/bunlet-cef/bunlet-cef.darwin-arm64.node');
  if (existsSync(cefHelperPath) || existsSync(cefNodePath)) {
    console.log('  [OK]  CEF native module built');
  } else {
    console.log('  [INFO] CEF native module not built (optional, system webview will be used)');
  }

  // Check platform-specific dependencies
  if (process.platform === 'linux') {
    const linuxDeps = [
      'libwebkit2gtk-4.1-dev',
      'libayatana-appindicator3-dev',
      'libx11-dev',
      'librsvg2-dev',
    ];
    console.log('\n  Linux platform dependencies:');
    try {
      const dpkgOutput = execSync('dpkg -l ' + linuxDeps.join(' ') + ' 2>/dev/null', { encoding: 'utf-8' });
      for (const dep of linuxDeps) {
        if (dpkgOutput.includes(dep)) {
          console.log(`    [OK]  ${dep}`);
        } else {
          console.log(`    [FAIL] ${dep} not installed`);
          issues++;
        }
      }
    } catch {
      console.log('    [WARN] Could not check Linux package dependencies');
    }
  }

  if (process.platform === 'darwin') {
    try {
      const xcodeOutput = execSync('xcode-select -p', { encoding: 'utf-8' }).trim();
      console.log(`  [OK]  Xcode Command Line Tools: ${xcodeOutput}`);
    } catch {
      console.log('  [FAIL] Xcode Command Line Tools not installed. Run: xcode-select --install');
      issues++;
    }
  }

  // TypeScript compilation check
  try {
    const tsPkg = join(process.cwd(), 'node_modules/typescript/package.json');
    if (existsSync(tsPkg)) {
      const tsVer = JSON.parse(readFileSync(tsPkg, 'utf-8')).version;
      console.log(`  [OK]  TypeScript ${tsVer}`);
    }
  } catch {
    // TypeScript is optional
  }

  // Print summary
  console.log();
  if (issues === 0) {
    console.log('  ✓ All checks passed. Ready to develop!\n');
  } else {
    console.log(`  ✗ ${issues} issue(s) found. Fix them before developing.\n`);
  }

  process.exit(issues > 0 ? 1 : 0);
}