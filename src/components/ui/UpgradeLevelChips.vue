<script setup lang="ts">
/* One upgrade's levels as chips (P0 to P4) for setting a level on several
   heroes at once. Each chip takes that level's pill fill, so a chip reads as
   the pill it produces. */

import { computed } from 'vue'

import UpgradeLevelLabel from './UpgradeLevelLabel.vue'
import { ATTR_PARAGON, attrMax } from '@/lib/characters/attributes'
import { pillFill } from '@/lib/characters/upgradeStats'
import { useI18nStore } from '@/stores/i18n'

const {
  attrId,
  lit = null,
  disabled = false,
} = defineProps<{
  attrId: number
  lit?: number | null
  disabled?: boolean
}>()

const emit = defineEmits<{ pick: [level: number] }>()

const i18n = useI18nStore()

const kind = computed(() => (attrId === ATTR_PARAGON ? 'paragon' : 'refinement'))
const max = computed(() => attrMax(attrId))
const levels = computed(() => Array.from({ length: max.value + 1 }, (_, level) => level))
</script>

<template>
  <span class="level-chips">
    <button
      v-for="level in levels"
      :key="level"
      type="button"
      class="level-chip"
      :class="{ lit: lit === level, max: level >= max }"
      :style="{ background: pillFill(attrId, level) }"
      :disabled
      :aria-pressed="lit === level"
      :aria-label="`${i18n.t(`app.${kind}`)} ${level}`"
      @click="emit('pick', level)"
    >
      <UpgradeLevelLabel :kind :level />
    </button>
  </span>
</template>

<style scoped>
.level-chips {
  display: inline-flex;
  gap: calc(5px * var(--dock-scale));
}

.level-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: calc(27px * var(--dock-scale));
  height: calc(20px * var(--dock-scale));
  padding: 0 calc(5px * var(--dock-scale));
  border: none;
  border-radius: 999px;
  font: inherit;
  font-size: calc(10px * var(--dock-scale));
  font-weight: 800;
  letter-spacing: 0.02em;
  color: var(--upgrade-pill-gray-text);
  box-shadow:
    var(--upgrade-pill-rim),
    0 1px 2px rgba(0, 0, 0, 0.2);
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast),
    opacity var(--transition-fast);
}

.level-chip.max {
  color: #fff;
}

.level-chip:hover:not(:disabled) {
  transform: translateY(-1px);
}

.level-chip.lit {
  box-shadow:
    0 0 0 2px #fff,
    0 0 0 4px var(--color-primary),
    0 2px 6px rgba(0, 0, 0, 0.2);
}

.level-chip:disabled {
  opacity: 0.35;
  cursor: default;
}

@media (pointer: coarse) {
  .level-chips {
    gap: 7px;
  }

  .level-chip {
    min-width: 36px;
    height: 28px;
    font-size: 11px;
  }
}
</style>
