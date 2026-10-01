<script setup lang="ts">
/* The paragon / refinement pill, board-free: levels in, taps out. It lets the
   import review and the Rosters tab edit levels off the board, and shows levels
   read-only in the picker and under the board panel's portraits (whose taps the
   panel handles through the grid context). One component, so a level reads the
   same everywhere. */

import { computed } from 'vue'

import UpgradeLevelLabel from '@/components/ui/UpgradeLevelLabel.vue'
import { ATTR_PARAGON, ATTR_REFINEMENT, attrMax } from '@/lib/characters/attributes'
import { pillBackground } from '@/lib/characters/upgradeStats'
import { useI18nStore } from '@/stores/i18n'

const {
  paragon,
  refinement,
  editable = false,
  compact = false,
  reserved = false,
  nested = false,
} = defineProps<{
  paragon: number
  refinement: number
  editable?: boolean
  // Narrower touch halves for a dense grid (the Rosters tab), keeping their height.
  compact?: boolean
  // Invisible but still sized, so a hero grid's cells stay one width: the pill is
  // wider than a phone portrait.
  reserved?: boolean
  // Inside another control (the board panel's hero button): the halves are plain
  // spans, since a button can't hold buttons and a disabled one would swallow the
  // host's taps.
  nested?: boolean
}>()

const emit = defineEmits<{
  paragon: [level: number]
  refinement: [level: number]
}>()

const i18n = useI18nStore()

const MAX_PARAGON = attrMax(ATTR_PARAGON)
const MAX_REFINEMENT = attrMax(ATTR_REFINEMENT)
const background = computed(() => pillBackground(paragon, refinement))
const segment = computed(() => (nested ? 'span' : 'button'))
const segmentAttrs = computed(() => (nested ? {} : { type: 'button', disabled: !editable }))

const next = (level: number, max: number): number => (level >= max ? 0 : level + 1)
</script>

<template>
  <span
    class="upill"
    :class="{ editable, compact, reserved, nested }"
    :style="{ background }"
    :aria-hidden="reserved || undefined"
  >
    <component
      :is="segment"
      v-bind="segmentAttrs"
      class="useg"
      :class="{ max: paragon >= MAX_PARAGON }"
      :aria-label="nested ? undefined : `${i18n.t('app.paragon')} ${paragon}`"
      @click="editable && emit('paragon', next(paragon, MAX_PARAGON))"
    >
      <UpgradeLevelLabel kind="paragon" :level="paragon" />
    </component>
    <component
      :is="segment"
      v-bind="segmentAttrs"
      class="useg"
      :class="{ max: refinement >= MAX_REFINEMENT }"
      :aria-label="nested ? undefined : `${i18n.t('app.refinement')} ${refinement}`"
      @click="editable && emit('refinement', next(refinement, MAX_REFINEMENT))"
    >
      <UpgradeLevelLabel kind="refinement" :level="refinement" />
    </component>
  </span>
</template>

<style scoped>
.upill {
  display: inline-flex;
  border-radius: 999px;
  overflow: hidden;
  box-shadow:
    var(--upgrade-pill-rim),
    0 1px 3px rgba(0, 0, 0, 0.22);
  /* Size knobs a host sets on the pill: the board panel sizes it per container width. */
  font-size: var(--upill-font-size, 10px);
  font-weight: 800;
  letter-spacing: 0.02em;
}

.useg {
  flex: 1 1 0;
  min-width: var(--upill-min-width, 24px);
  padding: var(--upill-pad-block, 2.5px) var(--upill-pad-inline, 5px);
  border: none;
  background: transparent;
  font: inherit;
  color: var(--upgrade-pill-gray-text);
  cursor: default;
}

.editable .useg {
  cursor: pointer;
}

.nested .useg {
  cursor: inherit;
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
    padding: 11px 8px;
  }

  .editable.compact .useg {
    min-width: 28px;
    padding-inline: 4px;
  }
}
</style>
