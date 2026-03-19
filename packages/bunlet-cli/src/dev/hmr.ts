/**
 * HMR (Hot Module Replacement) Protocol
 *
 * Defines the message format for communication between
 * the dev server and renderer clients.
 */

/**
 * Types of HMR updates
 */
export type HMRUpdateType =
  | 'connected'
  | 'update'
  | 'full-reload'
  | 'css-update'
  | 'error'
  | 'prune';

/**
 * Module update information
 */
export interface ModuleUpdate {
  type: 'js-update' | 'css-update';
  path: string;
  acceptedPath: string;
  timestamp: number;
}

/**
 * HMR update message sent to clients
 */
export interface HMRUpdate {
  type: HMRUpdateType;
  timestamp: number;
  updates?: ModuleUpdate[];
  path?: string;
  error?: HMRError;
}

/**
 * HMR error information
 */
export interface HMRError {
  message: string;
  stack?: string;
  file?: string;
  line?: number;
  column?: number;
  frame?: string;
}

/**
 * Client-to-server messages
 */
export interface HMRClientMessage {
  type: 'ping' | 'custom';
  event?: string;
  data?: unknown;
}

/**
 * Create an HMR update message
 */
export function createUpdate(
  type: HMRUpdateType,
  data?: Partial<HMRUpdate>
): HMRUpdate {
  return {
    type,
    timestamp: Date.now(),
    ...data,
  };
}

/**
 * Create a module update
 */
export function createModuleUpdate(
  path: string,
  type: 'js-update' | 'css-update' = 'js-update'
): ModuleUpdate {
  return {
    type,
    path,
    acceptedPath: path,
    timestamp: Date.now(),
  };
}

/**
 * Create an error update
 */
export function createErrorUpdate(error: Error | string, file?: string): HMRUpdate {
  const err = typeof error === 'string' ? new Error(error) : error;
  return createUpdate('error', {
    error: {
      message: err.message,
      stack: err.stack,
      file,
    },
  });
}
