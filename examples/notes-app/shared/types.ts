/**
 * Shared types for Notes App
 */

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

export interface NotesStore {
  notes: Note[];
  categories: Category[];
  settings: AppSettings;
}

export interface AppSettings {
  defaultCategory: string;
  sortBy: 'createdAt' | 'updatedAt' | 'title';
  sortOrder: 'asc' | 'desc';
  theme: 'light' | 'dark' | 'system';
}

export interface ListNotesParams {
  search?: string;
  category?: string;
  tags?: string[];
  includeArchived?: boolean;
}

export interface CreateNoteParams {
  title: string;
  content: string;
  category?: string;
  tags?: string[];
}

export interface UpdateNoteParams {
  id: string;
  title?: string;
  content?: string;
  category?: string;
  tags?: string[];
  isPinned?: boolean;
}
