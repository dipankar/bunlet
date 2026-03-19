/**
 * Bunlet configuration types and helpers
 */

export interface BunletConfig {
  main?: string;
  preload?: string;
  renderer?: {
    root?: string;
    index?: string;
    entry?: string;
  };
  webview?: {
    engine?: 'system' | 'cef';
    cef?: {
      cachePath?: string;
      remoteDebuggingPort?: number;
      disableGpu?: boolean;
    };
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

/**
 * Preserve strong typing for user config files.
 */
export function defineConfig<T extends BunletConfig>(config: T): T {
  return config;
}
