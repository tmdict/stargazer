<script lang="ts">
/* A row of pill segments: the Teams mode and type pickers and the Saved Teams
   sort and filters (`small`). The default slot replaces a segment's label,
   e.g. with a ConfirmLabel for a two-step confirm. */

export interface Segment {
  key: string
  label: string
  selected: boolean
  // The armed step of a two-step confirm (useArmedConfirm).
  armed?: boolean
}
</script>

<script setup lang="ts" generic="T extends Segment">
defineProps<{
  segments: readonly T[]
  small?: boolean
}>()

const emit = defineEmits<{ select: [key: T['key']] }>()

defineSlots<{ default?(props: { segment: T }): unknown }>()
</script>

<template>
  <!-- Toggle-button semantics (not radiogroup): plain buttons already give the
       full keyboard interaction, where role="radio" would promise the roving
       arrow-key pattern without delivering it. -->
  <div class="segmented-picker" :class="{ small }" role="group">
    <button
      v-for="segment in segments"
      :key="segment.key"
      type="button"
      :aria-pressed="segment.selected"
      class="segment"
      :class="{ active: segment.selected, 'confirm-armed': segment.armed }"
      @click="emit('select', segment.key)"
    >
      <slot :segment>{{ segment.label }}</slot>
    </button>
  </div>
</template>

<style scoped>
.segmented-picker {
  display: inline-flex;
  background: var(--color-bg-secondary);
  border: 2px solid var(--color-border-primary);
  border-radius: 999px;
  padding: 3px;
  gap: 2px;
}

.segmented-picker.small {
  border-width: 1.5px;
  padding: 2px;
}

.segment {
  border: none;
  background: transparent;
  border-radius: 999px;
  padding: 5px 16px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.small .segment {
  padding: 3px 12px;
  font-size: 0.78rem;
}

.segment:hover:not(.active):not(.confirm-armed) {
  color: var(--color-primary);
  background: var(--color-bg-tertiary);
}

.segment.active {
  background: var(--color-primary);
  color: #fff;
}

.segment.confirm-armed {
  background: var(--color-danger-hover);
  color: #fff;
}

@media (max-width: 480px) {
  .segmented-picker:not(.small) .segment {
    padding: 4px 10px;
    font-size: 0.78rem;
  }
}
</style>
