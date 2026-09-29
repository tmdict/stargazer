<script setup lang="ts">
/* The paragon / refinement pill, board-free: levels in, taps out. The hero
   panel's pill edits a placed hero through the grid context; this one lets
   the import review and the Rosters tab edit levels off the board, and shows
   a roster's levels read-only in the picker. Same fills and slanted seam, so
   a level reads the same everywhere. */

import { computed } from 'vue'

import { ATTR_PARAGON, ATTR_REFINEMENT, attrMax } from '@/lib/characters/attributes'
import { pillBackground } from '@/lib/characters/upgradeStats'
import { useI18nStore } from '@/stores/i18n'

const {
  paragon,
  refinement,
  editable = false,
  compact = false,
  reserved = false,
} = defineProps<{
  paragon: number
  refinement: number
  editable?: boolean
  // Narrower touch halves for a dense grid (the Rosters tab), keeping their height.
  compact?: boolean
  // Invisible but still sized, so a hero grid's cells stay one width: the pill is
  // wider than a phone portrait.
  reserved?: boolean
}>()

const emit = defineEmits<{
  paragon: [level: number]
  refinement: [level: number]
}>()

const i18n = useI18nStore()

const MAX_PARAGON = attrMax(ATTR_PARAGON)
const MAX_REFINEMENT = attrMax(ATTR_REFINEMENT)
const background = computed(() => pillBackground(paragon, refinement))

const next = (level: number, max: number): number => (level >= max ? 0 : level + 1)
</script>

<template>
  <span
    class="upill"
    :class="{ editable, compact, reserved }"
    :style="{ background }"
    :aria-hidden="reserved || undefined"
  >
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
  padding: 3px 6px 4px;
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

/* Hidden, it also takes no clicks. */
.reserved {
  visibility: hidden;
}

.useg.max {
  color: #fff;
}

/* Wider tap targets on touch screens (the pill is the only control for levels). */
@media (pointer: coarse) {
  .editable .useg {
    min-width: 40px;
    padding: 9px 8px 10px;
  }

  .editable.compact .useg {
    min-width: 28px;
    padding-inline: 4px;
  }
}
</style>
