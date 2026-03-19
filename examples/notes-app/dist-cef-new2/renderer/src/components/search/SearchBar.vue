<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const localValue = ref(props.modelValue);
let debounceTimer: number | null = null;

watch(
  () => props.modelValue,
  (newVal) => {
    localValue.value = newVal;
  }
);

function handleInput(e: Event) {
  const target = e.target as HTMLInputElement;
  localValue.value = target.value;

  // Debounce the emit
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = window.setTimeout(() => {
    emit('update:modelValue', target.value);
  }, 200);
}

function handleClear() {
  localValue.value = '';
  emit('update:modelValue', '');
}
</script>

<template>
  <div class="search-bar">
    <span class="search-icon">🔍</span>
    <input
      type="search"
      class="search-input"
      :value="localValue"
      placeholder="Search notes..."
      @input="handleInput"
    />
    <button
      v-if="localValue"
      class="clear-btn"
      @click="handleClear"
      title="Clear search"
    >
      ×
    </button>
  </div>
</template>

<style scoped>
.search-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
}

.search-icon {
  font-size: 0.875rem;
  color: var(--text-muted);
}

.search-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 0.875rem;
  color: var(--text-primary);
}

.search-input::placeholder {
  color: var(--text-muted);
}

/* Remove default search styling */
.search-input::-webkit-search-cancel-button {
  display: none;
}

.clear-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: none;
  background: var(--text-muted);
  color: white;
  border-radius: 50%;
  cursor: pointer;
  font-size: 0.875rem;
  line-height: 1;
}

.clear-btn:hover {
  background: var(--text-secondary);
}
</style>
