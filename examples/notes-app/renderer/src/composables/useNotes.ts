/**
 * Notes state management composable
 */

import { ref, computed, watch } from 'vue';
import { notesApi, categoriesApi, settingsApi } from '../utils/ipc';
import type { Note, Category, AppSettings } from '../utils/ipc';

// State
const notes = ref<Note[]>([]);
const categories = ref<Category[]>([]);
const settings = ref<AppSettings | null>(null);
const selectedNoteId = ref<string | null>(null);
const searchQuery = ref('');
const selectedCategory = ref<string | null>(null);
const isLoading = ref(false);
const error = ref<string | null>(null);

// Computed
const selectedNote = computed(() => {
  if (!selectedNoteId.value) return null;
  return notes.value.find((n) => n.id === selectedNoteId.value) || null;
});

const filteredNotes = computed(() => {
  let result = notes.value;

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(
      (n) =>
        n.title.toLowerCase().includes(query) ||
        n.content.toLowerCase().includes(query) ||
        n.tags.some((t) => t.toLowerCase().includes(query))
    );
  }

  if (selectedCategory.value) {
    result = result.filter((n) => n.category === selectedCategory.value);
  }

  return result;
});

// Actions
async function loadNotes() {
  isLoading.value = true;
  error.value = null;
  try {
    notes.value = await notesApi.list();
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    isLoading.value = false;
  }
}

async function loadCategories() {
  try {
    categories.value = await categoriesApi.list();
  } catch (e) {
    console.error('Failed to load categories:', e);
  }
}

async function loadSettings() {
  try {
    settings.value = await settingsApi.get();
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
}

async function createNote(title: string, content: string = '') {
  try {
    const note = await notesApi.create({
      title,
      content,
      category: selectedCategory.value || settings.value?.defaultCategory,
    });
    notes.value = [note, ...notes.value];
    selectedNoteId.value = note.id;
    return note;
  } catch (e) {
    error.value = (e as Error).message;
    return null;
  }
}

async function updateNote(
  id: string,
  data: {
    title?: string;
    content?: string;
    category?: string;
    tags?: string[];
    isPinned?: boolean;
  }
) {
  try {
    const updatedNote = await notesApi.update(id, data);
    const index = notes.value.findIndex((n) => n.id === id);
    if (index !== -1 && updatedNote) {
      notes.value[index] = updatedNote;
    }
    return updatedNote;
  } catch (e) {
    error.value = (e as Error).message;
    return null;
  }
}

async function deleteNote(id: string, permanent = false) {
  try {
    await notesApi.delete(id, permanent);
    notes.value = notes.value.filter((n) => n.id !== id);
    if (selectedNoteId.value === id) {
      selectedNoteId.value = notes.value[0]?.id || null;
    }
    return true;
  } catch (e) {
    error.value = (e as Error).message;
    return false;
  }
}

async function createCategory(name: string, color: string, icon?: string) {
  try {
    const category = await categoriesApi.create({ name, color, icon });
    categories.value = [...categories.value, category];
    return category;
  } catch (e) {
    error.value = (e as Error).message;
    return null;
  }
}

async function deleteCategory(id: string) {
  try {
    await categoriesApi.delete(id);
    categories.value = categories.value.filter((c) => c.id !== id);
    if (selectedCategory.value === id) {
      selectedCategory.value = null;
    }
    // Reload notes as some may have moved to default category
    await loadNotes();
    return true;
  } catch (e) {
    error.value = (e as Error).message;
    return false;
  }
}

async function updateSettings(data: Partial<AppSettings>) {
  try {
    settings.value = await settingsApi.update(data);
    return settings.value;
  } catch (e) {
    error.value = (e as Error).message;
    return null;
  }
}

function selectNote(id: string | null) {
  selectedNoteId.value = id;
}

function setSearchQuery(query: string) {
  searchQuery.value = query;
}

function setSelectedCategory(categoryId: string | null) {
  selectedCategory.value = categoryId;
}

// Initialize
async function initialize() {
  await Promise.all([loadNotes(), loadCategories(), loadSettings()]);
}

export function useNotes() {
  return {
    // State
    notes,
    categories,
    settings,
    selectedNote,
    selectedNoteId,
    filteredNotes,
    searchQuery,
    selectedCategory,
    isLoading,
    error,

    // Actions
    initialize,
    loadNotes,
    loadCategories,
    loadSettings,
    createNote,
    updateNote,
    deleteNote,
    createCategory,
    deleteCategory,
    updateSettings,
    selectNote,
    setSearchQuery,
    setSelectedCategory,
  };
}
