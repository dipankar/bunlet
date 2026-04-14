/**
 * Bunlet configuration schema, types, and helpers.
 *
 * This module is the single source of truth for config validation.
 * Both the runtime (`bunlet`) and the CLI (`@bunlet/cli`) use this
 * schema so that validation stays in sync.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

export const rendererConfigSchema = z.object({
  root: z.string().optional(),
  index: z.string().optional(),
  entry: z.string().optional(),
});

export const cefConfigSchema = z.object({
  cachePath: z.string().optional(),
  remoteDebuggingPort: z.number().int().positive().optional(),
  disableGpu: z.boolean().optional(),
});

export const webviewConfigSchema = z.object({
  engine: z.enum(['system', 'cef']).optional(),
  cef: cefConfigSchema.optional(),
});

export const buildConfigSchema = z.object({
  outDir: z.string().optional(),
  minify: z.boolean().optional(),
  sourcemap: z.union([z.boolean(), z.enum(['inline', 'external'])]).optional(),
  bytecode: z.boolean().optional(),
  external: z.array(z.string()).optional(),
  define: z.record(z.string()).optional(),
});

export const macPackageConfigSchema = z.object({
  category: z.string().optional(),
  target: z.array(z.string()).optional(),
  identity: z.string().optional(),
});

export const winPackageConfigSchema = z.object({
  target: z.array(z.string()).optional(),
});

export const linuxPackageConfigSchema = z.object({
  target: z.array(z.string()).optional(),
  category: z.string().optional(),
  maintainer: z.string().optional(),
});

export const packageConfigSchema = z.object({
  name: z.string().optional(),
  version: z.string().optional(),
  description: z.string().optional(),
  author: z.string().optional(),
  icon: z.string().optional(),
  bundleId: z.string().optional(),
  category: z.string().optional(),
  mac: macPackageConfigSchema.optional(),
  win: winPackageConfigSchema.optional(),
  linux: linuxPackageConfigSchema.optional(),
});

export const publishConfigSchema = z.object({
  provider: z.enum(['github', 's3', 'generic']).optional(),
  owner: z.string().optional(),
  repo: z.string().optional(),
  token: z.string().optional(),
  bucket: z.string().optional(),
  region: z.string().optional(),
  url: z.string().optional(),
});

export const bunletConfigSchema = z.object({
  main: z.string().optional(),
  preload: z.string().optional(),
  renderer: rendererConfigSchema.optional(),
  webview: webviewConfigSchema.optional(),
  build: buildConfigSchema.optional(),
  package: packageConfigSchema.optional(),
  publish: publishConfigSchema.optional(),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript types from the Zod schemas
// ---------------------------------------------------------------------------

export type BunletConfig = z.infer<typeof bunletConfigSchema>;

// ---------------------------------------------------------------------------
// defineConfig — validates at configuration time (for user config files)
// ---------------------------------------------------------------------------

export function defineConfig<T extends BunletConfig>(config: T): T {
  bunletConfigSchema.parse(config);
  return config;
}

// ---------------------------------------------------------------------------
// Parse-result helper — returns a typed result without throwing
// ---------------------------------------------------------------------------

export interface ConfigParseResult {
  config: BunletConfig;
  warnings: string[];
}

export function parseConfig(raw: unknown): ConfigParseResult {
  const warnings: string[] = [];

  const result = bunletConfigSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((i) => {
      const path = i.path.join('.');
      return path ? `${path}: ${i.message}` : i.message;
    });
    throw new Error(`Invalid Bunlet config:\n${issues.join('\n')}`);
  }

  // Collect soft warnings for suspicious but parseable values
  const config = result.data;

  if (config.package?.version && !/^\d+\.\d+\.\d+/.test(config.package.version)) {
    warnings.push(`package.version "${config.package.version}" does not look like a semver version`);
  }

  if (config.webview?.engine === 'cef' && !config.webview.cef) {
    warnings.push('webview.engine is "cef" but no webview.cef options provided; defaults will be used');
  }

  return { config, warnings };
}