<script setup lang="ts">
export interface FilterPill {
  name: string
  label: string
}

defineProps<{
  pills: FilterPill[]
}>()

// Using defineModel for v-model support - handles single selection
const modelValue = defineModel<string | null>({ default: null })

const handlePillClick = (pillName: string) => {
  // Toggle: deselect if already selected, otherwise select the clicked pill
  modelValue.value = modelValue.value === pillName ? null : pillName
}
</script>

<template>
  <div class="filter-pills">
    <div class="pills-container">
      <button
        v-for="pill in pills"
        :key="pill.name"
        class="pill"
        :class="{ selected: modelValue === pill.name }"
        @click="handlePillClick(pill.name)"
      >
        {{ pill.label }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.filter-pills {
  display: contents;
}

.pills-container {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-md);
  align-items: center;
  margin-top: var(--spacing-lg);
  margin-bottom: var(--spacing-sm);
}

.pill {
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

.pill:hover {
  background: var(--color-bg-secondary);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.pill:active,
.pill.selected:active {
  transform: scale(0.95);
  background: var(--color-bg-primary);
}

.pill.selected {
  background: var(--color-bg-secondary);
  border-color: var(--color-primary);
}

@media (max-width: 768px) {
  .pills-container {
    gap: var(--spacing-sm);
    margin-top: var(--spacing-sm);
    margin-bottom: var(--spacing-sm);
  }

  .pill {
    font-size: 0.8rem;
    padding: var(--spacing-xs) var(--spacing-sm);
  }
}

@media (max-width: 480px) {
  .pills-container {
    gap: var(--spacing-xs);
    margin-top: var(--spacing-xs);
    margin-bottom: var(--spacing-xs);
  }

  .pill {
    font-size: 0.75rem;
    padding: 4px 10px;
  }
}
</style>
