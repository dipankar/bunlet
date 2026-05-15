/**
 * Native bindings loader
 * Loads the platform-specific native addon
 */

import type * as NativeTypes from '@bunlet/native';
import * as fs from 'fs';
import * as path from 'path';
import { BunletError, BunletErrorCode } from '../errors';

export type RuntimeEngine = 'system' | 'cef';

export function detectEngine(): RuntimeEngine {
  const fromEnv = process.env.BUNLET_WEBVIEW_ENGINE;
  if (fromEnv === 'cef' || fromEnv === 'system') {
    return fromEnv;
  }

  // Build/package bootstrap fallback. The CLI writes the selected engine into
  // the bundled app's package metadata so runtime selection does not need to
  // inspect source config files.
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')) as {
        bunlet?: { webview?: { engine?: string } };
      };
      if (pkg.bunlet?.webview?.engine === 'cef') {
        return 'cef';
      }
    } catch {
      // Ignore malformed package metadata
    }
  }

  return 'system';
}

export function loadBinding(): typeof NativeTypes {
  const engine = detectEngine();

  if (engine === 'cef') {
    try {
      // @ts-ignore - optional package
      return require('@bunlet/cef');
    } catch (e) {
      throw new BunletError(
        BunletErrorCode.NATIVE_LOAD_FAILED,
        'CEF engine requested but @bunlet/cef failed to load. ' +
        'Ensure it is installed and built (run "bun --filter @bunlet/cef run build").',
        { cause: e }
      );
    }
  }

  try {
    // @ts-ignore - Dynamic require for native addon
    return require('@bunlet/native');
  } catch (e) {
    throw new BunletError(
      BunletErrorCode.NATIVE_LOAD_FAILED,
      'Native bindings not found. Please build the native module first: cd packages/bunlet-native && bun run build',
      { cause: e }
    );
  }
}

const native = loadBinding();

export default native;
