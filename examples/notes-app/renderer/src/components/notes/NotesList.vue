<script setup lang="ts">
import type { Note, Category } from '../../utils/ipc';
import NoteCard from './NoteCard.vue';

defineProps<{
  notes: Note[];
  selectedId?: string;
  categories: Category[];
}>();

const emit = defineEmits<{
  (e: 'select', id: string): void;
  (e: 'delete', id: string): void;
}>();

function getCategoryColor(categoryId: string, categories: Category[]): string {
  const category = categories.find((c) => c.id === categoryId);
  return category?.color || '#888888';
}
</script>

<template>
  <div class="notes-list">
    <template v-if="notes.length > 0">
      <NoteCard
        v-for="note in notes"
        :key="note.id"
        :note="note"
        :is-selected="note.id === selectedId"
        :category-color="getCategoryColor(note.category, categories)"
        @click="emit('select', note.id)"
        @delete="emit('delete', note.id)"
      />
    </template>
    <template v-else>
      <div class="empty-state">
        <div class="empty-state-icon">📭</div>
        <div class="empty-state-title">No notes</div>
        <div class="empty-state-text">Create your first note to get started</div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.notes-list {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
}
</style>
