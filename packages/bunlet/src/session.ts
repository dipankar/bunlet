/**
 * Session and Cookie Management API for bunlet
 *
 * Provides cookie management and session handling for browser windows.
 *
 * @example
 * ```typescript
 * import { Session, session } from '@bunlet/core';
 *
 * // Get default session
 * const defaultSession = session.defaultSession;
 *
 * // Work with cookies
 * const cookies = await defaultSession.cookies.get({ url: 'https://example.com' });
 *
 * // Set a cookie
 * await defaultSession.cookies.set({
 *   url: 'https://example.com',
 *   name: 'myCookie',
 *   value: 'myValue',
 * });
 *
 * // Clear storage data
 * await defaultSession.clearStorageData();
 * ```
 */

import { EventEmitter } from 'events';
import { assertRuntimeCapability, native } from './runtime';

interface SessionWebPreferencesLike {
  partition?: string;
  session?: Session;
}

/**
 * Cookie information
 */
export interface Cookie {
  /** Cookie name */
  name: string;
  /** Cookie value */
  value: string;
  /** Cookie domain */
  domain?: string;
  /** Cookie path */
  path?: string;
  /** Whether cookie is secure */
  secure?: boolean;
  /** Whether cookie is HTTP-only */
  httpOnly?: boolean;
  /** Same-site policy: 'Strict' | 'Lax' | 'None' */
  sameSite?: 'Strict' | 'Lax' | 'None';
  /** Expiration date as Unix timestamp (seconds since epoch) */
  expirationDate?: number;
  /** Session cookie (no expiration date) */
  session?: boolean;
}

/**
 * Filter options for getting cookies
 */
export interface CookieFilter {
  /** URL to filter cookies by */
  url?: string;
  /** Cookie name to filter by */
  name?: string;
  /** Cookie domain to filter by */
  domain?: string;
  /** Cookie path to filter by */
  path?: string;
  /** Filter by secure flag */
  secure?: boolean;
  /** Filter by session cookies */
  session?: boolean;
}

/**
 * Options for setting a cookie
 */
export interface CookieDetails {
  /** URL to associate with the cookie (required) */
  url: string;
  /** Cookie name (required) */
  name: string;
  /** Cookie value (required) */
  value: string;
  /** Cookie domain */
  domain?: string;
  /** Cookie path */
  path?: string;
  /** Whether the cookie is secure */
  secure?: boolean;
  /** Whether the cookie is HTTP-only */
  httpOnly?: boolean;
  /** Same-site policy */
  sameSite?: 'Strict' | 'Lax' | 'None';
  /** Expiration date as Unix timestamp (seconds) */
  expirationDate?: number;
}

/**
 * Options for clearing storage data
 */
export interface ClearStorageDataOptions {
  /** Origin to clear data for */
  origin?: string;
  /** Storage types to clear */
  storages?: Array<
    'cookies' | 'filesystem' | 'indexdb' | 'localstorage' | 'shadercache' | 'websql' | 'serviceworkers' | 'cachestorage'
  >;
  /** Quota types to clear */
  quotas?: Array<'temporary' | 'persistent' | 'syncable'>;
}

/**
 * Cookies class for managing cookies in a session
 */
export class Cookies extends EventEmitter {
  private readonly getWindowId: () => number | null;

  constructor(getWindowId: () => number | null) {
    super();
    this.getWindowId = getWindowId;
  }

  /**
   * Get cookies matching a filter
   * @param filter - Filter options
   * @returns Promise resolving to array of cookies
   */
  async get(filter?: CookieFilter): Promise<Cookie[]> {
    assertRuntimeCapability('cookies', 'session.cookies.get()');
    const windowId = this.getWindowId();
    if (windowId === null) {
      return [];
    }

    try {
      const cookies = await native.getCookies(windowId);
      let result: Cookie[] = cookies.map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain ?? undefined,
        path: c.path ?? undefined,
        secure: c.secure ?? undefined,
        httpOnly: c.httpOnly ?? undefined,
        sameSite: c.sameSite as Cookie['sameSite'],
        expirationDate: c.expirationDate ?? undefined,
        session: !c.expirationDate,
      }));

      // Apply filters
      if (filter) {
        if (filter.name) {
          result = result.filter((c) => c.name === filter.name);
        }
        if (filter.domain) {
          const fd = filter.domain;
          result = result.filter((c) => {
            if (!c.domain) return false;
            if (c.domain === fd) return true;
            // A cookie for ".example.com" should match filter "example.com"
            // but "notexample.com" should NOT match filter "example.com"
            const dotted = fd.startsWith('.') ? fd : `.${fd}`;
            return c.domain === dotted || c.domain?.endsWith(dotted);
          });
        }
        if (filter.path) {
          result = result.filter((c) => c.path === filter.path || c.path?.startsWith(filter.path!));
        }
        if (filter.secure !== undefined) {
          result = result.filter((c) => c.secure === filter.secure);
        }
        if (filter.session !== undefined) {
          result = result.filter((c) => c.session === filter.session);
        }
      }

      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      throw new Error(`[bunlet] session.cookies.get() failed: ${error.message}`);
    }
  }

  /**
   * Set a cookie
   * @param details - Cookie details
   */
  async set(details: CookieDetails): Promise<void> {
    assertRuntimeCapability('cookies', 'session.cookies.set()');
    const windowId = this.getWindowId();
    if (windowId === null) {
      throw new Error('No window associated with this session');
    }

    const cookie = {
      name: details.name,
      value: details.value,
      domain: details.domain,
      path: details.path ?? '/',
      secure: details.secure,
      httpOnly: details.httpOnly,
      sameSite: details.sameSite,
      expirationDate: details.expirationDate,
    };

    native.setCookie(windowId, cookie);
    this.emit('changed', { cookie, removed: false, cause: 'explicit' });
  }

  /**
   * Remove a cookie
   * @param url - URL associated with the cookie
   * @param name - Cookie name
   */
  async remove(url: string, name: string): Promise<void> {
    assertRuntimeCapability('cookies', 'session.cookies.remove()');
    const windowId = this.getWindowId();
    if (windowId === null) {
      throw new Error('No window associated with this session');
    }

    native.removeCookie(windowId, name, url);
    this.emit('changed', { cookie: { name }, removed: true, cause: 'explicit' });
  }

  /**
   * Flush the cookie store to disk
   * Note: This is a no-op in bunlet as cookies are persisted by the underlying WebView
   */
  async flushStore(): Promise<void> {
    throw new Error(
      `[bunlet] session.cookies.flushStore() is not yet supported. ` +
      `The underlying webview handles cookie persistence automatically.`
    );
  }

  // Event emitter type overloads
  on(
    event: 'changed',
    listener: (event: { cookie: Partial<Cookie>; removed: boolean; cause: string }) => void
  ): this;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string, listener: (...args: any[]) => void): this {
    return super.on(event, listener);
  }
}

/**
 * Session class representing a session partition
 */
export class Session extends EventEmitter {
  private static sessions = new Map<string, Session>();
  private static _defaultSession: Session | null = null;
  private static windowToPartition = new Map<number, string>();

  /** Session partition name */
  readonly partition: string;

  /** Cookies manager for this session */
  readonly cookies: Cookies;

  /** Windows currently attached to this session */
  private readonly attachedWindowIds = new Set<number>();

  private constructor(partition: string) {
    super();
    this.partition = partition;
    this.cookies = new Cookies(() => this.getRepresentativeWindowId());
  }

  /**
   * Get the default session (no partition)
   */
  static get defaultSession(): Session {
    if (!Session._defaultSession) {
      Session._defaultSession = new Session('');
    }
    return Session._defaultSession;
  }

  /**
   * Get or create a session for a partition
   * @param partition - Partition name (prefix with 'persist:' for persistent storage)
   */
  static fromPartition(partition: string): Session {
    assertRuntimeCapability('sessionPartitions', 'Session.fromPartition()');
    const normalizedPartition = normalizePartition(partition);
    if (normalizedPartition === '') {
      return Session.defaultSession;
    }

    let session = Session.sessions.get(normalizedPartition);
    if (!session) {
      session = new Session(normalizedPartition);
      Session.sessions.set(normalizedPartition, session);
    }

    return session;
  }

  /**
   * Resolve the session associated with a window's web preferences.
   * @internal
   */
  static resolveForWebPreferences(webPreferences?: SessionWebPreferencesLike): Session {
    if (!webPreferences) {
      return Session.defaultSession;
    }

    if (webPreferences.session && webPreferences.partition) {
      const normalizedPartition = normalizePartition(webPreferences.partition);
      if (webPreferences.session.partition !== normalizedPartition) {
        throw new Error(
          `Session partition mismatch: expected ${normalizedPartition}, received ${webPreferences.session.partition}`
        );
      }
    }

    if (webPreferences.session) {
      return webPreferences.session;
    }

    if (webPreferences.partition) {
      return Session.fromPartition(webPreferences.partition);
    }

    return Session.defaultSession;
  }

  /**
   * Attach a window to a session partition.
   * @internal
   */
  static attachWindow(windowId: number, session: Session): void {
    const existingPartition = Session.windowToPartition.get(windowId);
    if (existingPartition && existingPartition !== session.partition) {
      Session.getByPartition(existingPartition)?.detachWindow(windowId);
    }

    Session.windowToPartition.set(windowId, session.partition);
    session.attachWindow(windowId);
  }

  /**
   * Detach a window from its associated session partition.
   * @internal
   */
  static detachWindow(windowId: number): void {
    const partition = Session.windowToPartition.get(windowId);
    if (partition === undefined) {
      return;
    }

    Session.windowToPartition.delete(windowId);
    Session.getByPartition(partition)?.detachWindow(windowId);
  }

  /**
   * Clear storage data for this session
   * @param options - Options for what to clear
   */
  async clearStorageData(options?: ClearStorageDataOptions): Promise<void> {
    assertRuntimeCapability('cookies', 'session.clearStorageData()');
    const windowId = this.getRepresentativeWindowId();
    if (windowId === null) {
      throw new Error('No window associated with this session');
    }

    const nativeOptions: {
      cookies?: boolean;
      localStorage?: boolean;
      sessionStorage?: boolean;
      indexedDb?: boolean;
      cacheStorage?: boolean;
    } = {};

    if (options?.storages) {
      nativeOptions.cookies = options.storages.includes('cookies');
      nativeOptions.localStorage = options.storages.includes('localstorage');
      nativeOptions.sessionStorage = false; // sessionStorage is per-tab, not clearable this way
      nativeOptions.indexedDb = options.storages.includes('indexdb');
      nativeOptions.cacheStorage = options.storages.includes('cachestorage');
    }

    native.clearStorageData(windowId, nativeOptions);
  }

  /**
   * Clear the HTTP cache
   */
  async clearCache(): Promise<void> {
    assertRuntimeCapability('cookies', 'session.clearCache()');
    const windowId = this.getRepresentativeWindowId();
    if (windowId === null) {
      throw new Error('No window associated with this session');
    }

    // Clear cache storage
    native.clearStorageData(windowId, {
      cookies: false,
      localStorage: false,
      sessionStorage: false,
      indexedDb: false,
      cacheStorage: true,
    });
  }

  /**
   * Get the user agent for this session
   */
  async getUserAgent(): Promise<string> {
    assertRuntimeCapability('cookies', 'session.getUserAgent()');
    const windowId = this.getRepresentativeWindowId();
    if (windowId === null) {
      throw new Error('No window associated with this session');
    }

    const result = await native.getUserAgent(windowId);
    if (result === '') {
      throw new Error(
        `[bunlet] session.getUserAgent() is not supported by the system webview backend. ` +
        `Use the CEF backend for real user agent access.`
      );
    }
    return result;
  }

  /**
   * Check if spell checker is enabled
   * Note: Spell checking is not yet implemented in bunlet
   */
  isSpellCheckerEnabled(): boolean {
    throw new Error(
      `[bunlet] session.isSpellCheckerEnabled() is not yet supported. ` +
      `Spell checking is not implemented.`
    );
  }

  setSpellCheckerEnabled(_enable: boolean): void {
    throw new Error(
      `[bunlet] session.setSpellCheckerEnabled() is not yet supported. ` +
      `Spell checking is not implemented.`
    );
  }

  // Event emitter type overloads
  on(event: 'will-download', listener: (event: unknown, item: unknown, webContents: unknown) => void): this;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string, listener: (...args: any[]) => void): this {
    return super.on(event, listener);
  }

  private static getByPartition(partition: string): Session | null {
    if (partition === '') {
      return Session.defaultSession;
    }
    return Session.sessions.get(partition) ?? null;
  }

  private attachWindow(windowId: number): void {
    this.attachedWindowIds.add(windowId);
  }

  private detachWindow(windowId: number): void {
    this.attachedWindowIds.delete(windowId);
  }

  private getRepresentativeWindowId(): number | null {
    const result = this.attachedWindowIds.values().next();
    return result.done ? null : result.value;
  }
}

/**
 * Session module for accessing sessions
 */
export const session = {
  /**
   * Get the default session
   */
  get defaultSession(): Session {
    return Session.defaultSession;
  },

  /**
   * Get or create a session from partition
   * @param partition - Partition name
   */
  fromPartition(partition: string): Session {
    return Session.fromPartition(partition);
  },
};

function normalizePartition(partition: string): string {
  if (!partition) {
    return '';
  }

  // In Electron, partitions starting with 'persist:' are persistent (stored on disk).
  // Partitions without 'persist:' prefix are ephemeral (in-memory only).
  // We preserve the prefix distinction so callers can choose session lifetime.
  // The default session (empty string) is always persistent.
  if (partition.startsWith('persist:')) {
    return partition;
  }

  // A partition string without 'persist:' is an ephemeral partition.
  // Prepend a namespace to avoid collisions with the default session.
  return `ephemeral:${partition}`;
}

/**
 * Resolve the session for a window's web preferences.
 * @internal
 */
export function resolveSessionForWebPreferences(
  webPreferences?: SessionWebPreferencesLike
): Session {
  return Session.resolveForWebPreferences(webPreferences);
}

/**
 * Attach a window to a session partition.
 * @internal
 */
export function attachSessionToWindow(windowId: number, currentSession: Session): void {
  Session.attachWindow(windowId, currentSession);
}

/**
 * Detach a window from its session partition.
 * @internal
 */
export function detachSessionFromWindow(windowId: number): void {
  Session.detachWindow(windowId);
}
