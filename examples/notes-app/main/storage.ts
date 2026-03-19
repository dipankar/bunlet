/**
 * NotesStorage - Persists notes to JSON file in userData directory
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'bunlet';
import { v4 as uuidv4 } from 'uuid';
import type {
  Note,
  Category,
  NotesStore,
  AppSettings,
  ListNotesParams,
  CreateNoteParams,
  UpdateNoteParams,
} from '../shared/types';

const DATA_FILE = 'notes-data.json';

export class NotesStorage {
  private dataPath: string;
  private data: NotesStore;

  constructor() {
    const userDataDir = app.getPath('userData');
    if (!fs.existsSync(userDataDir)) {
      fs.mkdirSync(userDataDir, { recursive: true });
    }
    this.dataPath = path.join(userDataDir, DATA_FILE);
    this.data = this.load();
  }

  private load(): NotesStore {
    if (fs.existsSync(this.dataPath)) {
      try {
        const content = fs.readFileSync(this.dataPath, 'utf-8');
        return JSON.parse(content);
      } catch {
        return this.getDefaultStore();
      }
    }
    return this.getDefaultStore();
  }

  private save(): void {
    fs.writeFileSync(this.dataPath, JSON.stringify(this.data, null, 2));
  }

  private getDefaultStore(): NotesStore {
    return {
      notes: [],
      categories: [
        { id: 'personal', name: 'Personal', color: '#4CAF50', icon: '👤' },
        { id: 'work', name: 'Work', color: '#2196F3', icon: '💼' },
        { id: 'ideas', name: 'Ideas', color: '#FF9800', icon: '💡' },
      ],
      settings: {
        defaultCategory: 'personal',
        sortBy: 'updatedAt',
        sortOrder: 'desc',
        theme: 'system',
      },
    };
  }

  // Notes CRUD

  listNotes(params: ListNotesParams = {}): Note[] {
    let notes = this.data.notes.filter((n) => !n.isArchived || params.includeArchived);

    if (params.search) {
      const search = params.search.toLowerCase();
      notes = notes.filter(
        (n) =>
          n.title.toLowerCase().includes(search) ||
          n.content.toLowerCase().includes(search) ||
          n.tags.some((t) => t.toLowerCase().includes(search))
      );
    }

    if (params.category) {
      notes = notes.filter((n) => n.category === params.category);
    }

    if (params.tags && params.tags.length > 0) {
      notes = notes.filter((n) => params.tags!.some((t) => n.tags.includes(t)));
    }

    // Sort notes
    const { sortBy, sortOrder } = this.data.settings;
    notes.sort((a, b) => {
      // Pinned notes always come first
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;

      let comparison = 0;
      if (sortBy === 'title') {
        comparison = a.title.localeCompare(b.title);
      } else {
        comparison = new Date(a[sortBy]).getTime() - new Date(b[sortBy]).getTime();
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return notes;
  }

  getNote(id: string): Note | null {
    return this.data.notes.find((n) => n.id === id) || null;
  }

  createNote(params: CreateNoteParams): Note {
    const now = new Date().toISOString();
    const note: Note = {
      id: uuidv4(),
      title: params.title,
      content: params.content,
      category: params.category || this.data.settings.defaultCategory,
      tags: params.tags || [],
      createdAt: now,
      updatedAt: now,
      isPinned: false,
      isArchived: false,
    };
    this.data.notes.push(note);
    this.save();
    return note;
  }

  updateNote(params: UpdateNoteParams): Note | null {
    const index = this.data.notes.findIndex((n) => n.id === params.id);
    if (index === -1) return null;

    const note = this.data.notes[index];
    if (params.title !== undefined) note.title = params.title;
    if (params.content !== undefined) note.content = params.content;
    if (params.category !== undefined) note.category = params.category;
    if (params.tags !== undefined) note.tags = params.tags;
    if (params.isPinned !== undefined) note.isPinned = params.isPinned;
    note.updatedAt = new Date().toISOString();

    this.data.notes[index] = note;
    this.save();
    return note;
  }

  archiveNote(id: string): boolean {
    const note = this.data.notes.find((n) => n.id === id);
    if (!note) return false;
    note.isArchived = true;
    note.updatedAt = new Date().toISOString();
    this.save();
    return true;
  }

  permanentlyDeleteNote(id: string): boolean {
    const index = this.data.notes.findIndex((n) => n.id === id);
    if (index === -1) return false;
    this.data.notes.splice(index, 1);
    this.save();
    return true;
  }

  // Categories

  listCategories(): Category[] {
    return this.data.categories;
  }

  createCategory(params: { name: string; color: string; icon?: string }): Category {
    const category: Category = {
      id: uuidv4(),
      name: params.name,
      color: params.color,
      icon: params.icon,
    };
    this.data.categories.push(category);
    this.save();
    return category;
  }

  deleteCategory(id: string): boolean {
    const index = this.data.categories.findIndex((c) => c.id === id);
    if (index === -1) return false;
    this.data.categories.splice(index, 1);
    // Move notes in this category to default
    this.data.notes.forEach((n) => {
      if (n.category === id) {
        n.category = this.data.settings.defaultCategory;
      }
    });
    this.save();
    return true;
  }

  // Settings

  getSettings(): AppSettings {
    return this.data.settings;
  }

  updateSettings(params: Partial<AppSettings>): AppSettings {
    Object.assign(this.data.settings, params);
    this.save();
    return this.data.settings;
  }
}

// Singleton instance
let storageInstance: NotesStorage | null = null;

export function getStorage(): NotesStorage {
  if (!storageInstance) {
    storageInstance = new NotesStorage();
  }
  return storageInstance;
}
