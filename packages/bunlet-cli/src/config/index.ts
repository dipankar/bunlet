/**
 * Shared Bunlet CLI config loading.
 *
 * All CLI commands should load project configuration through this module so
 * config file resolution, package metadata fallback, and Zod validation
 * happen in one place.
 *
 * The Zod schemas and TypeScript types are re-exported from the runtime
 * package (`bunlet/config`) so there is a single source of truth.
 */

import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import {
  bunletConfigSchema,
  parseConfig,
  type BunletConfig,
  type ConfigParseResult,
} from '@bunlet/core/config';

export type { BunletConfig, ConfigParseResult } from '@bunlet/core/config';

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
 *
 * Validates the loaded config with the shared Zod schema and returns the
 * parsed result including any soft warnings.
 */
export async function loadBunletConfig(root: string): Promise<BunletConfig> {
  const { config } = await loadBunletConfigWithWarnings(root);
  return config;
}

/**
 * Load config and also return validation warnings.
 */
export async function loadBunletConfigWithWarnings(root: string): Promise<ConfigParseResult> {
  let raw: unknown = {};

  for (const configFile of CONFIG_FILES) {
    const configPath = path.join(root, configFile);

    if (!fs.existsSync(configPath)) {
      continue;
    }

    try {
      if (configFile.endsWith('.json')) {
        raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      } else {
        const module = await import(pathToFileURL(configPath).href);
        raw = module.default || module;
      }
      break;
    } catch (error) {
      console.warn(`Warning: Failed to load ${configFile}:`, error);
    }
  }

  return parseConfig(raw);
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