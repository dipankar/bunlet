/**
 * Session and Cookie Management API for bunlet
 *
 * Provides cookie management and session handling for browser windows.
 *
 * @example
 * ```typescript
 * import { Session, session } from 'bunlet';
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
import native from './native/bindings';

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
  private windowId: number | null = null;

  constructor() {
    super();
  }

  /**
   * Set the window ID for cookie operations
   * @internal
   */
  setWindowId(windowId: number): void {
    this.windowId = windowId;
  }

  /**
   * Get cookies matching a filter
   * @param filter - Filter options
   * @returns Promise resolving to array of cookies
   */
  async get(filter?: CookieFilter): Promise<Cookie[]> {
    if (this.windowId === null) {
      return [];
    }

    try {
      const cookies = await native.getCookies(this.windowId);
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
          result = result.filter((c) => c.domain === filter.domain || c.domain?.endsWith(filter.domain!));
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
    } catch {
      return [];
    }
  }

  /**
   * Set a cookie
   * @param details - Cookie details
   */
  async set(details: CookieDetails): Promise<void> {
    if (this.windowId === null) {
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

    native.setCookie(this.windowId, cookie);
    this.emit('changed', { cookie, removed: false, cause: 'explicit' });
  }

  /**
   * Remove a cookie
   * @param url - URL associated with the cookie
   * @param name - Cookie name
   */
  async remove(url: string, name: string): Promise<void> {
    if (this.windowId === null) {
      throw new Error('No window associated with this session');
    }

    native.removeCookie(this.windowId, name, url);
    this.emit('changed', { cookie: { name }, removed: true, cause: 'explicit' });
  }

  /**
   * Flush the cookie store to disk
   * Note: This is a no-op in bunlet as cookies are persisted by the underlying WebView
   */
  async flushStore(): Promise<void> {
    // No-op - the underlying WebView handles persistence
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

  /** Session partition name */
  readonly partition: string;

  /** Cookies manager for this session */
  readonly cookies: Cookies;

  /** Window ID associated with this session */
  private windowId: number | null = null;

  private constructor(partition: string) {
    super();
    this.partition = partition;
    this.cookies = new Cookies();
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
    const normalizedPartition = partition.startsWith('persist:') ? partition : `persist:${partition}`;

    let session = Session.sessions.get(normalizedPartition);
    if (!session) {
      session = new Session(normalizedPartition);
      Session.sessions.set(normalizedPartition, session);
    }

    return session;
  }

  /**
   * Associate a window with this session
   * @internal
   */
  setWindowId(windowId: number): void {
    this.windowId = windowId;
    this.cookies.setWindowId(windowId);
  }

  /**
   * Clear storage data for this session
   * @param options - Options for what to clear
   */
  async clearStorageData(options?: ClearStorageDataOptions): Promise<void> {
    if (this.windowId === null) {
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

    native.clearStorageData(this.windowId, nativeOptions);
  }

  /**
   * Clear the HTTP cache
   */
  async clearCache(): Promise<void> {
    if (this.windowId === null) {
      throw new Error('No window associated with this session');
    }

    // Clear cache storage
    native.clearStorageData(this.windowId, {
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
    if (this.windowId === null) {
      return 'bunlet';
    }

    return native.getUserAgent(this.windowId);
  }

  /**
   * Check if spell checker is enabled
   * Note: Spell checking is not yet implemented in bunlet
   */
  isSpellCheckerEnabled(): boolean {
    return false;
  }

  /**
   * Set spell checker enabled
   * Note: Spell checking is not yet implemented in bunlet
   */
  setSpellCheckerEnabled(_enable: boolean): void {
    // Not implemented
  }

  // Event emitter type overloads
  on(event: 'will-download', listener: (event: unknown, item: unknown, webContents: unknown) => void): this;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string, listener: (...args: any[]) => void): this {
    return super.on(event, listener);
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
