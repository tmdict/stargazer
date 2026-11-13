<script setup lang="ts">
/* The All, paragon and refinement chips that choose which upgrade layer the
   bulk actions edit. The owner holds the choice: the board docks share one
   page-wide choice, the Rosters tab keeps its own. */

import TooltipPopup from '@/components/ui/TooltipPopup.vue'
import UpgradeIcon from '@/components/ui/UpgradeIcon.vue'
import type { AttrLayerChoice } from '@/composables/useAttrLayerSelection'
import { useHoverTooltip } from '@/composables/useHoverTooltip'
import { ATTR_PARAGON, ATTR_REFINEMENT } from '@/lib/characters/attributes'
import { useI18nStore } from '@/stores/i18n'

defineProps<{ lit: AttrLayerChoice | null }>()

const emit = defineEmits<{ select: [choice: AttrLayerChoice] }>()

const i18n = useI18nStore()

type Chip = { choice: AttrLayerChoice; name: string; icon?: 'paragon' | 'refinement' }

const CHIPS: Chip[] = [
  { choice: 'all', name: 'app.all' },
  { choice: ATTR_PARAGON, name: 'app.paragon', icon: 'paragon' },
  { choice: ATTR_REFINEMENT, name: 'app.refinement', icon: 'refinement' },
]

const {
  anchor: tipEl,
  payload: tip,
  onMouseEnter: showTip,
  onMouseLeave: hideTip,
} = useHoverTooltip<string>()

const hover = (event: MouseEvent, chip: Chip): void => {
  if (chip.icon) showTip(event, i18n.t(chip.name))
}
</script>

<template>
  <span class="layer-chips">
    <button
      v-for="chip in CHIPS"
      :key="chip.choice"
      type="button"
      class="layer-chip"
      :class="{ lit: lit === chip.choice }"
      :aria-pressed="lit === chip.choice"
      :aria-label="i18n.t(chip.name)"
      @click="emit('select', chip.choice)"
      @mouseenter="hover($event, chip)"
      @mouseleave="hideTip"
    >
      <UpgradeIcon v-if="chip.icon" class="layer-icon" :kind="chip.icon" />
      <template v-else>{{ i18n.t(chip.name) }}</template>
    </button>
    <TooltipPopup v-if="tip && tipEl" :target-element="tipEl">
      <template #content>{{ tip }}</template>
    </TooltipPopup>
  </span>
</template>

<style scoped>
.layer-chips {
  display: inline-flex;
  gap: calc(6px * var(--dock-scale));
}

.layer-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1.5px solid var(--color-border-primary);
  background: var(--color-bg-raised);
  border-radius: 999px;
  font-size: calc(0.64rem * var(--dock-scale));
  font-weight: 800;
  padding: calc(2px * var(--dock-scale)) calc(13px * var(--dock-scale));
  min-height: calc(22px * var(--dock-scale));
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.layer-icon {
  font-size: 1.42em;
}

.layer-chip.lit {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
}
</style>
