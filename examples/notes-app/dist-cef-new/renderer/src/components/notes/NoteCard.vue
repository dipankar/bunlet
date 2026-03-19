<script setup lang="ts">
import { computed } from 'vue';
import type { Note } from '../../utils/ipc';

const props = defineProps<{
  note: Note;
  isSelected: boolean;
  categoryColor: string;
}>();

const emit = defineEmits<{
  (e: 'click'): void;
  (e: 'delete'): void;
}>();

const formattedDate = computed(() => {
  const date = new Date(props.note.updatedAt);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (days === 1) {
    return 'Yesterday';
  } else if (days < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
});

const preview = computed(() => {
  const content = props.note.content;
  if (!content) return 'No content';
  // Strip markdown and truncate
  return content
    .replace(/[#*`~\[\]]/g, '')
    .replace(/\n+/g, ' ')
    .substring(0, 100);
});

function handleDelete(e: Event) {
  e.stopPropagation();
  emit('delete');
}
</script>

<template>
  <div
    class="note-card"
    :class="{ selected: isSelected, pinned: note.isPinned }"
    @click="emit('click')"
  >
    <div class="note-card-header">
      <span
        class="category-dot"
        :style="{ backgroundColor: categoryColor }"
      ></span>
      <span v-if="note.isPinned" class="pin-icon">📌</span>
      <span class="note-date">{{ formattedDate }}</span>
      <button class="delete-btn" @click="handleDelete" title="Delete note">
        ×
      </button>
    </div>
    <h3 class="note-title">{{ note.title || 'Untitled' }}</h3>
    <p class="note-preview">{{ preview }}</p>
    <div v-if="note.tags.length > 0" class="note-tags">
      <span v-for="tag in note.tags.slice(0, 3)" :key="tag" class="tag">
        {{ tag }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.note-card {
  padding: 0.75rem;
  border-radius: var(--radius-md);
  cursor: pointer;
  margin-bottom: 0.5rem;
  transition: all 0.15s ease;
  border: 1px solid transparent;
}

.note-card:hover {
  background: var(--bg-secondary);
}

.note-card.selected {
  background: var(--accent-color);
  color: white;
}

.note-card.pinned {
  border-color: var(--accent-color);
}

.note-card-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.category-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.pin-icon {
  font-size: 0.75rem;
}

.note-date {
  flex: 1;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.note-card.selected .note-date {
  color: rgba(255, 255, 255, 0.7);
}

.delete-btn {
  opacity: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 1.25rem;
  color: var(--text-muted);
  border-radius: var(--radius-sm);
}

.note-card:hover .delete-btn {
  opacity: 1;
}

.delete-btn:hover {
  background: var(--danger-color);
  color: white;
}

.note-title {
  font-size: 0.9375rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.note-preview {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.note-card.selected .note-preview {
  color: rgba(255, 255, 255, 0.8);
}

.note-tags {
  display: flex;
  gap: 0.25rem;
  margin-top: 0.5rem;
  flex-wrap: wrap;
}

.tag {
  font-size: 0.6875rem;
  padding: 0.125rem 0.375rem;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 9999px;
  color: var(--text-secondary);
}

.note-card.selected .tag {
  background: rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.9);
}
</style>
