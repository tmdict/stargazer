<script setup lang="ts">
/* A reading's state in an import review: a button that confirms the reading,
   or a label saying it needs review, is not recognised, is picked twice or
   was edited. The default slot names a button that confirms several readings
   at once. */

import { computed } from 'vue'

import UpgradeIconText from '@/components/ui/UpgradeIconText.vue'
import { useI18nStore } from '@/stores/i18n'
import { interpolate } from '@/utils/interpolate'

type Shown = 'review' | 'none' | 'duplicate' | 'edited'

const props = defineProps<{
  state: Shown
  // The reading to confirm, offered on a button in place of the label. An
  // upgrade level reads `{paragon}2`, drawn with the upgrade's icon.
  reading?: string
  // The button shows the reading beside a check mark, for several in a row.
  compact?: boolean
}>()

const emit = defineEmits<{ confirm: [] }>()

const i18n = useI18nStore()

// A tooltip and a screen reader get the upgrade's name where the button shows its icon.
const words = (text: string): string =>
  interpolate(text, {
    paragon: `${i18n.t('app.paragon')} `,
    refinement: `${i18n.t('app.refinement')} `,
  })

const confirm = computed(() => {
  if (props.reading === undefined) return undefined
  const text = i18n.t('app.import-confirm', { value: props.reading })
  return {
    shown: props.compact ? `✓ ${props.reading}` : text,
    title: words(props.compact ? text : props.reading),
    ariaLabel: words(text),
  }
})

const LABEL: Record<Shown, string> = {
  review: 'app.import-review',
  none: 'app.import-unrecognised',
  duplicate: 'app.picked-twice',
  edited: 'app.import-edited',
}
</script>

<template>
  <button
    v-if="confirm !== undefined || $slots.default"
    type="button"
    class="cell-state confirm-choice"
    :class="state"
    :title="confirm?.title"
    :aria-label="confirm?.ariaLabel"
    @click="emit('confirm')"
  >
    <slot><UpgradeIconText v-if="confirm" :text="confirm.shown" /></slot>
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
