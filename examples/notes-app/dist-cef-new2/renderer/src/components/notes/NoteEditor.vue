<script setup lang="ts">
import { ref, watch } from 'vue';
import type { Note, Category } from '../../utils/ipc';
import CategoryBadge from '../categories/CategoryBadge.vue';

const props = defineProps<{
  note: Note;
  categories: Category[];
}>();

const emit = defineEmits<{
  (e: 'update:title', title: string): void;
  (e: 'update:content', content: string): void;
  (e: 'update:category', category: string): void;
  (e: 'toggle-pin'): void;
}>();

const localTitle = ref(props.note.title);
const localContent = ref(props.note.content);
const showCategoryPicker = ref(false);

// Sync with prop changes
watch(
  () => props.note.id,
  () => {
    localTitle.value = props.note.title;
    localContent.value = props.note.content;
  }
);

function handleTitleInput(e: Event) {
  const target = e.target as HTMLInputElement;
  localTitle.value = target.value;
  emit('update:title', target.value);
}

function handleContentInput(e: Event) {
  const target = e.target as HTMLTextAreaElement;
  localContent.value = target.value;
  emit('update:content', target.value);
}

function handleCategorySelect(categoryId: string) {
  emit('update:category', categoryId);
  showCategoryPicker.value = false;
}

function getCurrentCategory(): Category | undefined {
  return props.categories.find((c) => c.id === props.note.category);
}
</script>

<template>
  <div class="note-editor">
    <div class="editor-toolbar">
      <div class="toolbar-left">
        <div class="category-picker-wrapper">
          <button
            class="category-picker-btn"
            @click="showCategoryPicker = !showCategoryPicker"
          >
            <CategoryBadge
              v-if="getCurrentCategory()"
              :category="getCurrentCategory()!"
            />
            <span v-else>Select category</span>
          </button>
          <div v-if="showCategoryPicker" class="category-dropdown">
            <button
              v-for="category in categories"
              :key="category.id"
              class="category-option"
              @click="handleCategorySelect(category.id)"
            >
              <span
                class="category-color"
                :style="{ backgroundColor: category.color }"
              ></span>
              <span>{{ category.icon }} {{ category.name }}</span>
            </button>
          </div>
        </div>
      </div>
      <div class="toolbar-right">
        <button
          class="btn-icon"
          :class="{ active: note.isPinned }"
          @click="emit('toggle-pin')"
          :title="note.isPinned ? 'Unpin note' : 'Pin note'"
        >
          📌
        </button>
      </div>
    </div>

    <div class="editor-content">
      <input
        type="text"
        class="title-input"
        :value="localTitle"
        placeholder="Note title..."
        @input="handleTitleInput"
      />
      <textarea
        class="content-textarea"
        :value="localContent"
        placeholder="Start writing in Markdown..."
        @input="handleContentInput"
      ></textarea>
    </div>

    <div class="editor-footer">
      <span class="footer-text">
        Last edited: {{ new Date(note.updatedAt).toLocaleString() }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.note-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.editor-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-primary);
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.category-picker-wrapper {
  position: relative;
}

.category-picker-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-primary);
  cursor: pointer;
  font-size: 0.875rem;
}

.category-picker-btn:hover {
  background: var(--bg-secondary);
}

.category-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 0.25rem;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  z-index: 100;
  min-width: 150px;
  overflow: hidden;
}

.category-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  font-size: 0.875rem;
}

.category-option:hover {
  background: var(--bg-secondary);
}

.category-color {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.btn-icon.active {
  background: var(--accent-color);
  color: white;
}

.editor-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 1rem;
}

.title-input {
  width: 100%;
  font-size: 1.5rem;
  font-weight: 700;
  border: none;
  outline: none;
  padding: 0;
  margin-bottom: 1rem;
  background: transparent;
  color: var(--text-primary);
}

.title-input::placeholder {
  color: var(--text-muted);
}

.content-textarea {
  flex: 1;
  width: 100%;
  border: none;
  outline: none;
  resize: none;
  font-family: 'Fira Code', 'Consolas', monospace;
  font-size: 0.9375rem;
  line-height: 1.7;
  background: transparent;
  color: var(--text-primary);
}

.content-textarea::placeholder {
  color: var(--text-muted);
}

.editor-footer {
  padding: 0.5rem 1rem;
  border-top: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.footer-text {
  font-size: 0.75rem;
  color: var(--text-muted);
}
</style>
