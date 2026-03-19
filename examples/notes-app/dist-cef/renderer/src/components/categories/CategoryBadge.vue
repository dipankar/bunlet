<script setup lang="ts">
import type { Category } from '../../utils/ipc';

defineProps<{
  category: Category;
}>();
</script>

<template>
  <span
    class="category-badge"
    :style="{
      backgroundColor: category.color + '20',
      color: category.color,
      borderColor: category.color,
    }"
  >
    <span v-if="category.icon" class="badge-icon">{{ category.icon }}</span>
    <span class="badge-name">{{ category.name }}</span>
  </span>
</template>

<style scoped>
.category-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
  border: 1px solid;
}

.badge-icon {
  font-size: 0.6875rem;
}

.badge-name {
  font-size: 0.75rem;
}
</style>
