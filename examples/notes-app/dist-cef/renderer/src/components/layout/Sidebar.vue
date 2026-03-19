<script setup lang="ts">
import type { Category } from '../../utils/ipc';

defineProps<{
  categories: Category[];
  selectedCategory: string | null;
  notesCount: number;
}>();

const emit = defineEmits<{
  (e: 'select-category', category: string | null): void;
  (e: 'new-note'): void;
}>();
</script>

<template>
  <div class="sidebar">
    <div class="sidebar-header">
      <h1 class="app-title">Notes</h1>
      <button class="btn btn-primary" @click="emit('new-note')">
        <span>+</span> New
      </button>
    </div>

    <nav class="sidebar-nav">
      <div class="nav-section">
        <div class="nav-section-title">Library</div>
        <button
          class="nav-item"
          :class="{ active: selectedCategory === null }"
          @click="emit('select-category', null)"
        >
          <span class="nav-icon">📋</span>
          <span class="nav-label">All Notes</span>
          <span class="nav-count">{{ notesCount }}</span>
        </button>
      </div>

      <div class="nav-section">
        <div class="nav-section-title">Categories</div>
        <button
          v-for="category in categories"
          :key="category.id"
          class="nav-item"
          :class="{ active: selectedCategory === category.id }"
          @click="emit('select-category', category.id)"
        >
          <span class="nav-icon">{{ category.icon || '📁' }}</span>
          <span class="nav-label">{{ category.name }}</span>
          <span
            class="nav-color"
            :style="{ backgroundColor: category.color }"
          ></span>
        </button>
      </div>
    </nav>

    <div class="sidebar-footer">
      <div class="footer-text">Notes App v1.0.0</div>
    </div>
  </div>
</template>

<style scoped>
.sidebar {
  width: 220px;
  min-width: 180px;
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-color);
}

.app-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
}

.sidebar-nav {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem 0;
}

.nav-section {
  margin-bottom: 1rem;
}

.nav-section-title {
  padding: 0.5rem 1rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-muted);
  letter-spacing: 0.05em;
}

.nav-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  color: var(--text-secondary);
  transition: all 0.15s ease;
}

.nav-item:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.nav-item.active {
  background: var(--accent-color);
  color: white;
}

.nav-icon {
  font-size: 1rem;
}

.nav-label {
  flex: 1;
  font-size: 0.875rem;
}

.nav-count {
  font-size: 0.75rem;
  background: rgba(0, 0, 0, 0.1);
  padding: 0.125rem 0.375rem;
  border-radius: 9999px;
}

.nav-item.active .nav-count {
  background: rgba(255, 255, 255, 0.2);
}

.nav-color {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.sidebar-footer {
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--border-color);
}

.footer-text {
  font-size: 0.75rem;
  color: var(--text-muted);
}
</style>
