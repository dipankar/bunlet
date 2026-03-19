<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useNotes } from './composables/useNotes';
import { useIpc } from './composables/useIpc';
import Sidebar from './components/layout/Sidebar.vue';
import NotesList from './components/notes/NotesList.vue';
import NoteEditor from './components/notes/NoteEditor.vue';
import NotePreview from './components/notes/NotePreview.vue';
import SearchBar from './components/search/SearchBar.vue';

const {
  initialize,
  filteredNotes,
  selectedNote,
  categories,
  selectedCategory,
  searchQuery,
  createNote,
  updateNote,
  deleteNote,
  selectNote,
  setSearchQuery,
  setSelectedCategory,
} = useNotes();

const { showPreview, showSidebar, onMenuCommand } = useIpc();

// Auto-save debounce
const saveTimeout = ref<number | null>(null);

// Handle content changes with debounced save
function handleContentChange(content: string) {
  if (!selectedNote.value) return;

  // Clear existing timeout
  if (saveTimeout.value) {
    clearTimeout(saveTimeout.value);
  }

  // Debounce save
  saveTimeout.value = window.setTimeout(async () => {
    if (selectedNote.value) {
      await updateNote(selectedNote.value.id, { content });
    }
  }, 500);
}

// Handle title changes
async function handleTitleChange(title: string) {
  if (!selectedNote.value) return;
  await updateNote(selectedNote.value.id, { title });
}

// Handle new note
async function handleNewNote() {
  await createNote('Untitled Note');
}

// Handle delete note
async function handleDeleteNote(id: string) {
  await deleteNote(id);
}

// Handle category change
async function handleCategoryChange(category: string) {
  if (!selectedNote.value) return;
  await updateNote(selectedNote.value.id, { category });
}

// Handle pin toggle
async function handleTogglePin() {
  if (!selectedNote.value) return;
  await updateNote(selectedNote.value.id, {
    isPinned: !selectedNote.value.isPinned,
  });
}

// Set up menu commands
onMounted(async () => {
  await initialize();

  onMenuCommand('menu:new-note', handleNewNote);
  onMenuCommand('menu:toggle-preview', () => {
    showPreview.value = !showPreview.value;
  });
  onMenuCommand('menu:toggle-sidebar', () => {
    showSidebar.value = !showSidebar.value;
  });
});
</script>

<template>
  <div class="app">
    <!-- Sidebar -->
    <Sidebar
      v-if="showSidebar"
      :categories="categories"
      :selected-category="selectedCategory"
      :notes-count="filteredNotes.length"
      @select-category="setSelectedCategory"
      @new-note="handleNewNote"
    />

    <!-- Notes List -->
    <div class="notes-list-panel">
      <div class="notes-list-header">
        <SearchBar :model-value="searchQuery" @update:model-value="setSearchQuery" />
      </div>
      <NotesList
        :notes="filteredNotes"
        :selected-id="selectedNote?.id"
        :categories="categories"
        @select="selectNote"
        @delete="handleDeleteNote"
      />
    </div>

    <!-- Editor & Preview -->
    <div class="editor-panel">
      <template v-if="selectedNote">
        <div class="editor-container" :class="{ 'with-preview': showPreview }">
          <NoteEditor
            :note="selectedNote"
            :categories="categories"
            @update:title="handleTitleChange"
            @update:content="handleContentChange"
            @update:category="handleCategoryChange"
            @toggle-pin="handleTogglePin"
          />
          <NotePreview v-if="showPreview" :content="selectedNote.content" />
        </div>
      </template>
      <template v-else>
        <div class="empty-state">
          <div class="empty-state-icon">📝</div>
          <div class="empty-state-title">No note selected</div>
          <div class="empty-state-text">
            Select a note from the list or create a new one
          </div>
          <button class="btn btn-primary" style="margin-top: 1rem" @click="handleNewNote">
            New Note
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.app {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

.notes-list-panel {
  width: 300px;
  min-width: 250px;
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
}

.notes-list-header {
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);
}

.editor-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.editor-container {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.editor-container.with-preview > :first-child {
  flex: 1;
  border-right: 1px solid var(--border-color);
}

.editor-container.with-preview > :last-child {
  flex: 1;
}
</style>
