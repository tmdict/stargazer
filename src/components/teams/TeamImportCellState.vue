<script setup lang="ts">
/* A reading's state in an import review: a button that confirms the reading,
   or a label saying it needs review, is not recognised, is picked twice or
   was edited. */

import { useI18nStore } from '@/stores/i18n'

type Shown = 'review' | 'none' | 'duplicate' | 'edited'

defineProps<{
  state: Shown
  // The reading to confirm, offered on a button in place of the label.
  reading?: string
}>()

const emit = defineEmits<{ confirm: [] }>()

const i18n = useI18nStore()

const LABEL: Record<Shown, string> = {
  review: 'app.import-review',
  none: 'app.import-unrecognised',
  duplicate: 'app.picked-twice',
  edited: 'app.import-edited',
}
</script>

<template>
  <button
    v-if="reading !== undefined"
    type="button"
    class="cell-state confirm-choice"
    :class="state"
    @click="emit('confirm')"
  >
    {{ i18n.t('app.import-confirm', { value: reading }) }}
  </button>
  <span v-else class="cell-state" :class="state">{{ i18n.t(LABEL[state]) }}</span>
</template>

<style scoped>
.cell-state {
  font-size: 0.66rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.cell-state.review {
  color: var(--import-warn);
}

.confirm-choice {
  max-width: 100%;
  padding: 4px 6px;
  border: 1px solid currentColor;
  border-radius: var(--radius-medium);
  background: transparent;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.confirm-choice:hover,
.confirm-choice:focus-visible {
  background: var(--import-warn-tint);
}

.cell-state.none,
.cell-state.duplicate {
  color: var(--import-bad);
}

.cell-state.edited {
  color: var(--color-accent);
}

@media (pointer: coarse) {
  .confirm-choice {
    min-height: 32px;
  }
}
</style>
