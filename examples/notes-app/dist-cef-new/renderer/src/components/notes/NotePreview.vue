<script setup lang="ts">
import { computed } from 'vue';
import { parseMarkdown } from '../../utils/markdown';

const props = defineProps<{
  content: string;
}>();

const renderedContent = computed(() => parseMarkdown(props.content));
</script>

<template>
  <div class="note-preview">
    <div class="preview-header">
      <span class="preview-label">Preview</span>
    </div>
    <div class="preview-content markdown-preview" v-html="renderedContent" />
  </div>
</template>

<style scoped>
.note-preview {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--bg-primary);
}

.preview-header {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.preview-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-muted);
  letter-spacing: 0.05em;
}

.preview-content {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}
</style>
