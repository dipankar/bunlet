/**
 * Structured error taxonomy for Bunlet.
 *
 * All Bunlet errors carry a machine-readable code so consumers can
 * distinguish error categories without string-matching on messages.
 */

export enum BunletErrorCode {
  /** Native module failed to load (missing, wrong platform, build needed) */
  NATIVE_LOAD_FAILED = 'ERR_NATIVE_LOAD_FAILED',
  /** A runtime capability is missing for the requested operation */
  CAPABILITY_MISSING = 'ERR_CAPABILITY_MISSING',
  /** IPC handler not found for the requested channel */
  IPC_METHOD_NOT_FOUND = 'ERR_IPC_METHOD_NOT_FOUND',
  /** IPC message payload fails schema validation */
  IPC_VALIDATION_FAILED = 'ERR_IPC_VALIDATION_FAILED',
  /** Window not found in the window manager */
  WINDOW_NOT_FOUND = 'ERR_WINDOW_NOT_FOUND',
  /** File not found or path traversal attempt detected */
  FILE_NOT_FOUND = 'ERR_FILE_NOT_FOUND',
  /** Preload script failed to transpile or load */
  PRELOAD_FAILED = 'ERR_PRELOAD_FAILED',
  /** Context bridge is unavailable (context isolation not active) */
  CONTEXT_BRIDGE_UNAVAILABLE = 'ERR_CONTEXT_BRIDGE_UNAVAILABLE',
  /** Auto-updater integrity check failed */
  UPDATE_INTEGRITY_FAILED = 'ERR_UPDATE_INTEGRITY_FAILED',
  /** Auto-updater: no provider configured */
  UPDATE_NO_PROVIDER = 'ERR_UPDATE_NO_PROVIDER',
  /** Invalid configuration */
  CONFIG_INVALID = 'ERR_CONFIG_INVALID',
  /** Operation not implemented (yet) */
  NOT_IMPLEMENTED = 'ERR_NOT_IMPLEMENTED',
  /** Generic / unknown error */
  UNKNOWN = 'ERR_UNKNOWN',
}

export class BunletError extends Error {
  readonly code: BunletErrorCode;
  readonly cause?: unknown;

  constructor(code: BunletErrorCode, message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'BunletError';
    this.code = code;
    this.cause = options?.cause;
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      ...(this.cause !== undefined ? { cause: String(this.cause) } : {}),
    };
  }
}
