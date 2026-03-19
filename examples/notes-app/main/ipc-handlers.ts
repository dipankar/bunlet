/**
 * IPC Handlers for Notes App
 */

import { app, z } from 'bunlet';
import { getStorage } from './storage';

const storage = getStorage();

// ========== Notes CRUD ==========

app.handle(
  'notes:list',
  z.object({
    search: z.string().optional(),
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
    includeArchived: z.boolean().optional(),
  }),
  async (params) => {
    return storage.listNotes(params);
  }
);

app.handle(
  'notes:get',
  z.object({
    id: z.string(),
  }),
  async ({ id }) => {
    return storage.getNote(id);
  }
);

app.handle(
  'notes:create',
  z.object({
    title: z.string().min(1).max(200),
    content: z.string(),
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }),
  async (params) => {
    return storage.createNote(params);
  }
);

app.handle(
  'notes:update',
  z.object({
    id: z.string(),
    title: z.string().min(1).max(200).optional(),
    content: z.string().optional(),
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
    isPinned: z.boolean().optional(),
  }),
  async (params) => {
    return storage.updateNote(params);
  }
);

app.handle(
  'notes:delete',
  z.object({
    id: z.string(),
    permanent: z.boolean().optional(),
  }),
  async ({ id, permanent }) => {
    if (permanent) {
      return storage.permanentlyDeleteNote(id);
    }
    return storage.archiveNote(id);
  }
);

// ========== Categories ==========

app.handle('categories:list', z.object({}), async () => {
  return storage.listCategories();
});

app.handle(
  'categories:create',
  z.object({
    name: z.string().min(1).max(50),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    icon: z.string().optional(),
  }),
  async (params) => {
    return storage.createCategory(params);
  }
);

app.handle(
  'categories:delete',
  z.object({
    id: z.string(),
  }),
  async ({ id }) => {
    return storage.deleteCategory(id);
  }
);

// ========== Settings ==========

app.handle('settings:get', z.object({}), async () => {
  return storage.getSettings();
});

app.handle(
  'settings:update',
  z.object({
    defaultCategory: z.string().optional(),
    sortBy: z.enum(['createdAt', 'updatedAt', 'title']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    theme: z.enum(['light', 'dark', 'system']).optional(),
  }),
  async (params) => {
    return storage.updateSettings(params);
  }
);
