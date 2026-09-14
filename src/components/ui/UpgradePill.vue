<script setup lang="ts">
/* The paragon / refinement pill, board-free: levels in, taps out. The hero
   panel's pill edits a placed hero through the grid context; this one lets
   the import review edit a reading before it reaches a board. Same fills and
   slanted seam, so a level reads the same in both places. */

import { computed } from 'vue'

import { ATTR_PARAGON, ATTR_REFINEMENT, attrMax } from '@/lib/characters/attributes'
import { pillTone, type PillTone } from '@/lib/characters/upgradeStats'
import { useI18nStore } from '@/stores/i18n'

const {
  paragon,
  refinement,
  editable = false,
} = defineProps<{
  paragon: number
  refinement: number
  editable?: boolean
}>()

const emit = defineEmits<{
  paragon: [level: number]
  refinement: [level: number]
}>()

const i18n = useI18nStore()

const MAX_PARAGON = attrMax(ATTR_PARAGON)
const MAX_REFINEMENT = attrMax(ATTR_REFINEMENT)
const GRAY = 'var(--upgrade-pill-gray)'
const P_FILL: Record<PillTone, string> = {
  base: GRAY,
  mid: GRAY,
  max: 'var(--upgrade-pill-paragon-max)',
}
const R_FILL: Record<PillTone, string> = {
  base: GRAY,
  mid: 'var(--upgrade-pill-refinement-mid)',
  max: 'var(--upgrade-pill-refinement-max)',
}

// The white sliver keeps the slanted split visible when both halves share the gray.
const background = computed(
  () =>
    `linear-gradient(112deg, ${P_FILL[pillTone(ATTR_PARAGON, paragon)]} 48.6%, #fff 49.4%, #fff 50.6%, ${R_FILL[pillTone(ATTR_REFINEMENT, refinement)]} 51.4%)`,
)

const next = (level: number, max: number): number => (level >= max ? 0 : level + 1)
</script>

<template>
  <span class="upill" :class="{ editable }" :style="{ background }">
    <button
      type="button"
      class="useg"
      :class="{ max: paragon >= MAX_PARAGON }"
      :disabled="!editable"
      :aria-label="`${i18n.t('app.paragon')} ${paragon}`"
      @click="emit('paragon', next(paragon, MAX_PARAGON))"
    >
      P{{ paragon }}
    </button>
    <button
      type="button"
      class="useg"
      :class="{ max: refinement >= MAX_REFINEMENT }"
      :disabled="!editable"
      :aria-label="`${i18n.t('app.refinement')} ${refinement}`"
      @click="emit('refinement', next(refinement, MAX_REFINEMENT))"
    >
      R{{ refinement }}
    </button>
  </span>
</template>

<style scoped>
.upill {
  display: inline-flex;
  border-radius: 999px;
  overflow: hidden;
  border: 1.5px solid #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
  line-height: 1;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.02em;
}

.useg {
  flex: 1 1 0;
  min-width: 26px;
  padding: 4px 6px 3px;
  border: none;
  background: transparent;
  font: inherit;
  text-align: center;
  color: var(--upgrade-pill-gray-text);
  cursor: default;
}

.editable .useg {
  cursor: pointer;
}

.useg.max {
  color: #fff;
}

/* Wider tap targets on touch screens (the pill is the only control for levels). */
@media (pointer: coarse) {
  .useg {
    min-width: 40px;
    padding: 10px 8px 9px;
  }
}
</style>
