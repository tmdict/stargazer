<script setup lang="ts">
import { computed } from 'vue'

import type { TagType } from '../lib/types/character'
import { useI18nStore } from '../stores/i18n'
import { loadTags } from '../utils/dataLoader'

const props = defineProps<{
  selectedTagNames: string[]
}>()

const emit = defineEmits<{
  'tag-toggle': [tagName: string]
}>()

const i18n = useI18nStore()

const tags = computed<TagType[]>(() => {
  return loadTags()
})

const getTagLabel = (tagName: string): string => {
  return i18n.t(`app.${tagName}`)
}

const isTagSelected = (tagName: string): boolean => {
  return props.selectedTagNames.includes(tagName)
}

const handleTagClick = (tagName: string) => {
  emit('tag-toggle', tagName)
}
</script>

<template>
  <div class="tags-display">
    <div class="tags-container">
      <div
        v-for="tag in tags"
        :key="tag.name"
        class="tag-pill"
        :class="{ selected: isTagSelected(tag.name) }"
        @click="handleTagClick(tag.name)"
      >
        {{ getTagLabel(tag.name) }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.tags-display {
  display: contents;
}

.tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-md);
  align-items: center;
  margin-top: var(--spacing-lg);
  margin-bottom: var(--spacing-sm);
}

.tag-pill {
  display: inline-flex;
  align-items: center;
  padding: var(--spacing-xs) var(--spacing-md);
  background: var(--color-bg-tertiary);
  border: 2px solid var(--color-border-primary);
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  white-space: nowrap;
  transition: all var(--transition-fast);
  cursor: pointer;
}

.tag-pill:hover {
  background: var(--color-bg-secondary);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.tag-pill.selected {
  background: var(--color-bg-secondary);
  border-color: var(--color-primary);
}

@media (max-width: 768px) {
  .tags-container {
    gap: var(--spacing-sm);
    margin-top: var(--spacing-sm);
    margin-bottom: var(--spacing-sm);
  }

  .tag-pill {
    font-size: 0.8rem;
    padding: var(--spacing-xs) var(--spacing-sm);
  }
}

@media (max-width: 480px) {
  .tags-container {
    gap: var(--spacing-xs);
    margin-top: var(--spacing-xs);
    margin-bottom: var(--spacing-xs);
  }

  .tag-pill {
    font-size: 0.75rem;
    padding: 4px 10px;
  }
}
</style>
