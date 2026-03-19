/**
 * IPC Helper for renderer process
 * Wraps the window.__bunlet API with typed helpers
 */

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string;
  method: string;
  params: Record<string, unknown>;
}

interface JsonRpcResponse<T> {
  jsonrpc: '2.0';
  id: string;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

declare global {
  interface Window {
    __bunlet?: {
      invoke: (request: JsonRpcRequest) => void;
      onMessage: (callback: (message: string) => void) => void;
    };
  }
}

// Generate unique request ID
let requestId = 0;
const generateId = () => `${Date.now()}-${++requestId}`;

// Pending request handlers
const pendingRequests = new Map<
  string,
  {
    resolve: (value: unknown) => void;
    reject: (reason: Error) => void;
  }
>();

// Set up message listener
if (typeof window !== 'undefined' && window.__bunlet) {
  window.__bunlet.onMessage((message: string) => {
    try {
      const response = JSON.parse(message) as JsonRpcResponse<unknown>;
      const pending = pendingRequests.get(response.id);
      if (pending) {
        pendingRequests.delete(response.id);
        if (response.error) {
          pending.reject(new Error(response.error.message));
        } else {
          pending.resolve(response.result);
        }
      }
    } catch {
      // Ignore parse errors
    }
  });
}

export async function invoke<T>(
  method: string,
  params: Record<string, unknown> = {}
): Promise<T> {
  if (!window.__bunlet) {
    throw new Error('Bunlet IPC not available');
  }

  const id = generateId();

  const request: JsonRpcRequest = {
    jsonrpc: '2.0',
    id,
    method,
    params,
  };

  return new Promise((resolve, reject) => {
    pendingRequests.set(id, {
      resolve: resolve as (v: unknown) => void,
      reject,
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }
    }, 30000);

    window.__bunlet!.invoke(request);
  });
}

// Types
export interface Note {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  isPinned: boolean;
  isArchived: boolean;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon?: string;
}

export interface AppSettings {
  defaultCategory: string;
  sortBy: 'createdAt' | 'updatedAt' | 'title';
  sortOrder: 'asc' | 'desc';
  theme: 'light' | 'dark' | 'system';
}

// Notes API
export const notesApi = {
  list: (params?: {
    search?: string;
    category?: string;
    tags?: string[];
    includeArchived?: boolean;
  }) => invoke<Note[]>('notes:list', params || {}),

  get: (id: string) => invoke<Note | null>('notes:get', { id }),

  create: (data: {
    title: string;
    content: string;
    category?: string;
    tags?: string[];
  }) => invoke<Note>('notes:create', data),

  update: (
    id: string,
    data: {
      title?: string;
      content?: string;
      category?: string;
      tags?: string[];
      isPinned?: boolean;
    }
  ) => invoke<Note>('notes:update', { id, ...data }),

  delete: (id: string, permanent = false) =>
    invoke<boolean>('notes:delete', { id, permanent }),

  exportHtml: (id: string) =>
    invoke<{ success: boolean; path?: string; error?: string }>(
      'notes:export-html',
      { id }
    ),

  exportMarkdown: (id: string) =>
    invoke<{ success: boolean; path?: string; error?: string }>(
      'notes:export-markdown',
      { id }
    ),
};

// Categories API
export const categoriesApi = {
  list: () => invoke<Category[]>('categories:list', {}),

  create: (data: { name: string; color: string; icon?: string }) =>
    invoke<Category>('categories:create', data),

  delete: (id: string) => invoke<boolean>('categories:delete', { id }),
};

// Settings API
export const settingsApi = {
  get: () => invoke<AppSettings>('settings:get', {}),

  update: (data: Partial<AppSettings>) =>
    invoke<AppSettings>('settings:update', data),
};
