/**
 * Debug logging system with namespace filtering.
 *
 * Usage:
 *   import { createLogger } from 'bunlet/debug';
 *   const log = createLogger('ipc');
 *   log.info('Handler registered', { channel });
 *   log.warn('Slow response', { elapsed: 1200 });
 *   log.error('Handler failed', error);
 *
 * Enable via:
 *   BUNLET_DEBUG=ipc,bunlet:session  (comma-separated namespaces)
 *   BUNLET_DEBUG=*                     (all namespaces)
 *   BUNLET_DEBUG=bunlet:*              (all bunlet namespaces)
 *
 * Namespace conventions:
 *   bunlet:runtime   — Runtime backend selection, capability checks
 *   bunlet:ipc       — IPC handler routing, invoke/send
 *   bunlet:window    — Window creation, events, bounds
 *   bunlet:session   — Session partitions, cookies
 *   bunlet:config    — Config loading, validation
 *   bunlet:updater   — Auto-update checks, downloads, installs
 *   bunlet:native    — Native module calls
 *   bunlet:dev       — Dev server, HMR, file watching
 */

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface Logger {
  error(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
  readonly namespace: string;
}

const BUNLET_DEBUG_ENV = typeof process !== 'undefined' ? process.env.BUNLET_DEBUG ?? '' : '';

let enabledPatterns: RegExp[] = [];
let parsedDebugEnv = false;

function parseDebugEnv(): void {
  if (parsedDebugEnv) return;
  parsedDebugEnv = true;
  const env = BUNLET_DEBUG_ENV.trim();
  if (!env) {
    enabledPatterns = [];
    return;
  }
  if (env === '*') {
    enabledPatterns = [/.*/];
    return;
  }
  enabledPatterns = env.split(',').map((pattern) => {
    const trimmed = pattern.trim();
    if (!trimmed) return /^$/; // never matches
    // Convert glob-like patterns to regex
    const regexStr = trimmed
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(`^${regexStr}$`);
  });
}

function isNamespaceEnabled(namespace: string): boolean {
  parseDebugEnv();
  if (enabledPatterns.length === 0) return false;
  // Auto-prefix with "bunlet:" if not already prefixed
  const fullNamespace = namespace.startsWith('bunlet:') ? namespace : `bunlet:${namespace}`;
  return enabledPatterns.some((pattern) => pattern.test(fullNamespace) || pattern.test(namespace));
}

function formatLogArgs(level: LogLevel, namespace: string, message: string, args: unknown[]): string[] {
  const prefix = `[bunlet:${namespace}] ${level.toUpperCase()}`;
  if (args.length === 0) return [prefix, message];
  return [prefix, message, ...args];
}

function createLogMethod(level: LogLevel, namespace: string, enabled: boolean) {
  if (!enabled) {
    return () => {};
  }
  const consoleFn = level === 'error' ? console.error : level === 'warn' ? console.warn : level === 'debug' ? console.debug : console.log;
  return (message: string, ...args: unknown[]) => {
    consoleFn(...formatLogArgs(level, namespace, message, args));
  };
}

/**
 * Create a namespaced logger.
 *
 * @param namespace - Short namespace identifier (e.g. 'ipc', 'window', 'session')
 * @returns Logger instance
 */
export function createLogger(namespace: string): Logger {
  const enabled = isNamespaceEnabled(namespace);
  return {
    namespace,
    error: createLogMethod('error', namespace, true), // errors always shown
    warn: createLogMethod('warn', namespace, enabled),
    info: createLogMethod('info', namespace, enabled),
    debug: createLogMethod('debug', namespace, enabled),
  };
}

/**
 * Diagnostics: collect information about the runtime environment
 * for debugging capability, config, and backend issues.
 */
export function collectDiagnostics(): Record<string, unknown> {
  const diagnostics: Record<string, unknown> = {
    platform: typeof process !== 'undefined' ? process.platform : 'unknown',
    arch: typeof process !== 'undefined' ? process.arch : 'unknown',
    nodeVersion: typeof process !== 'undefined' ? process.version : 'unknown',
    bunletDebug: BUNLET_DEBUG_ENV || '(not set)',
  };

  // Backend info
  try {
    const { getRuntimeBackend } = require('./runtime/backend');
    const backend = getRuntimeBackend();
    diagnostics.backend = {
      engine: backend.engine,
      capabilities: backend.capabilities,
    };
  } catch (e) {
    diagnostics.backend = { error: String(e) };
  }

  // Native module info
  try {
    const native = require('@bunlet/native');
    diagnostics.nativeModule = {
      loaded: true,
      functions: Object.keys(native).sort(),
    };
  } catch (e) {
    diagnostics.nativeModule = { loaded: false, error: String(e) };
  }

  // Window manager state
  try {
    const { windowManager } = require('./windows/manager');
    diagnostics.windowCount = windowManager.getAll().length;
  } catch {
    diagnostics.windowCount = 0;
  }

  // Config
  try {
    const { loadBunletConfig } = require('./config');
    const config = loadBunletConfig(process.cwd());
    diagnostics.config = config ? { loaded: true, main: config.main } : { loaded: false };
  } catch (e) {
    diagnostics.config = { error: String(e) };
  }

  return diagnostics;
}

/**
 * Print a developer-friendly diagnostics report to stderr.
 */
export function printDiagnostics(): void {
  const diag = collectDiagnostics();
  console.error('=== Bunlet Diagnostics ===');
  for (const [key, value] of Object.entries(diag)) {
    console.error(`  ${key}: ${JSON.stringify(value, null, 2)}`);
  }
  console.error('=== End Diagnostics ===');
}