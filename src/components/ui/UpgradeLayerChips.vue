<script setup lang="ts">
/* The ALL / P / R chips that choose which upgrade layer the bulk actions edit.
   The owner holds the choice: the board docks share one page-wide choice, the
   Rosters tab keeps its own. */

import { computed } from 'vue'

import type { AttrLayerChoice } from '@/composables/useAttrLayerSelection'
import { ATTR_PARAGON, ATTR_REFINEMENT } from '@/lib/characters/attributes'
import { useI18nStore } from '@/stores/i18n'

defineProps<{ lit: AttrLayerChoice | null }>()

const emit = defineEmits<{ select: [choice: AttrLayerChoice] }>()

const i18n = useI18nStore()

const chips = computed((): { choice: AttrLayerChoice; label: string; name: string }[] => [
  { choice: 'all', label: i18n.t('app.all'), name: 'app.all' },
  { choice: ATTR_PARAGON, label: 'P', name: 'app.paragon' },
  { choice: ATTR_REFINEMENT, label: 'R', name: 'app.refinement' },
])
</script>

<template>
  <span class="layer-chips">
    <button
      v-for="chip in chips"
      :key="chip.choice"
      type="button"
      class="layer-chip"
      :class="{ lit: lit === chip.choice }"
      :aria-pressed="lit === chip.choice"
      :aria-label="i18n.t(chip.name)"
      :title="i18n.t(chip.name)"
      @click="emit('select', chip.choice)"
    >
      {{ chip.label }}
    </button>
  </span>
</template>

<style scoped>
.layer-chips {
  display: inline-flex;
  gap: 6px;
}

.layer-chip {
  border: 1.5px solid var(--color-border-primary);
  background: var(--color-bg-white);
  border-radius: 999px;
  font-size: 0.64rem;
  font-weight: 800;
  padding: 2px 13px;
  min-height: 22px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.layer-chip.lit {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
}
</style>
