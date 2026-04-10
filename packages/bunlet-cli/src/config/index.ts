/**
 * Shared Bunlet CLI config loading.
 *
 * All CLI commands should load project configuration through this module so
 * config file resolution, package metadata fallback, and future normalization
 * happen in one place.
 */

import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';

export interface BunletConfig {
  main?: string;
  preload?: string;
  renderer?: {
    root?: string;
    index?: string;
    entry?: string;
  };
  build?: {
    outDir?: string;
    minify?: boolean;
    sourcemap?: boolean | 'inline' | 'external';
    bytecode?: boolean;
    external?: string[];
    define?: Record<string, string>;
  };
  package?: {
    name?: string;
    version?: string;
    description?: string;
    author?: string;
    icon?: string;
    bundleId?: string;
    category?: string;
    mac?: {
      category?: string;
      target?: string[];
      identity?: string;
    };
    win?: {
      target?: string[];
    };
    linux?: {
      target?: string[];
      category?: string;
      maintainer?: string;
    };
  };
  webview?: {
    engine?: 'system' | 'cef';
    cef?: {
      cachePath?: string;
      remoteDebuggingPort?: number;
      disableGpu?: boolean;
    };
  };
  publish?: {
    provider?: 'github' | 's3' | 'generic';
    owner?: string;
    repo?: string;
    token?: string;
    bucket?: string;
    region?: string;
    url?: string;
  };
}

export interface ProjectPackageJson {
  name?: string;
  version?: string;
  description?: string;
  author?: string;
  bunlet?: {
    webview?: {
      engine?: 'system' | 'cef';
    };
  };
}

const CONFIG_FILES = [
  'bunlet.config.ts',
  'bunlet.config.js',
  'bunlet.config.mjs',
  'bunlet.config.json',
] as const;

/**
 * Load project config from the current application root.
 */
export async function loadBunletConfig(root: string): Promise<BunletConfig> {
  for (const configFile of CONFIG_FILES) {
    const configPath = path.join(root, configFile);

    if (!fs.existsSync(configPath)) {
      continue;
    }

    try {
      if (configFile.endsWith('.json')) {
        return JSON.parse(fs.readFileSync(configPath, 'utf-8')) as BunletConfig;
      }

      const module = await import(pathToFileURL(configPath).href);
      return (module.default || module) as BunletConfig;
    } catch (error) {
      console.warn(`Warning: Failed to load ${configFile}:`, error);
    }
  }

  return {};
}

/**
 * Load package metadata from the project root.
 */
export async function loadPackageJson(root: string): Promise<ProjectPackageJson> {
  const packageJsonPath = path.join(root, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')) as ProjectPackageJson;
  } catch {
    return {};
  }
}
