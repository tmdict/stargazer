<script setup lang="ts">
import { computed } from 'vue'

import TooltipPopup from './TooltipPopup.vue'
import { useHoverTooltip } from '@/composables/useHoverTooltip'
import { CLASS_ORDER, compareByOrder, FACTION_ORDER } from '@/lib/filterOrder'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'

const gameDataStore = useGameDataStore()
const i18n = useI18nStore()

const {
  options,
  iconPrefix,
  size = 36,
  showTooltip = true,
  activeBorderColor = 'var(--color-bg-white)',
} = defineProps<{
  options: string[]
  iconPrefix: string // 'class' or 'faction'
  size?: number // button size in px
  showTooltip?: boolean
  activeBorderColor?: string // CSS color for the selected icon's border
}>()
const modelValue = defineModel<string>({ required: true })

const iconSize = computed(() => Math.round(size * 0.78))
const factionIconSize = computed(() => Math.round(size * 0.89))
const borderWidth = computed(() => (size >= 36 ? 4 : 3))

const PREFIX_ORDERS: Record<string, readonly string[]> = {
  faction: FACTION_ORDER,
  class: CLASS_ORDER,
}

const orderedOptions = computed(() => {
  const order = PREFIX_ORDERS[iconPrefix]
  if (!order) return options
  return [...options].sort((a, b) => compareByOrder(a, b, order))
})

const getIconPath = (iconPrefix: string, option: string): string => {
  const iconKey = `${iconPrefix}-${option}`
  return gameDataStore.getIcon(iconKey)
}

// Filter buttons are action triggers: hover-only labels, suppressed on touch
// (the tap toggles the filter).
const {
  anchor: hoveredElement,
  payload: hoveredOption,
  onMouseEnter,
  onMouseLeave: handleMouseLeave,
  onTouchStart,
} = useHoverTooltip<string>()

const handleMouseEnter = (option: string, event: MouseEvent) => {
  if (!showTooltip) return
  onMouseEnter(event, option)
}
</script>

<template>
  <div class="icon-filter">
    <div class="icon-options">
      <!-- Clear/None option -->
      <button
        :class="['icon-option', 'clear-option', { active: modelValue === '' }]"
        :style="{
          width: `${size}px`,
          height: `${size}px`,
          '--active-border-color': activeBorderColor,
        }"
        @click="modelValue = ''"
      >
        <span class="clear-label" :style="{ fontSize: `${Math.round(size * 0.39)}px` }">{{
          i18n.t('app.all')
        }}</span>
      </button>

      <!-- Icon options -->
      <button
        v-for="option in orderedOptions"
        :key="option"
        :class="['icon-option', { active: modelValue === option }]"
        :style="{
          width: `${size}px`,
          height: `${size}px`,
          borderWidth: `${borderWidth}px`,
          '--active-border-color': activeBorderColor,
        }"
        @click="modelValue = modelValue === option ? '' : option"
        @mouseenter="handleMouseEnter(option, $event)"
        @mouseleave="handleMouseLeave"
        @touchstart.passive="onTouchStart"
      >
        <img
          :src="getIconPath(iconPrefix, option)"
          :alt="option"
          class="filter-icon"
          :style="{
            width: `${iconPrefix === 'faction' ? factionIconSize : iconSize}px`,
            height: `${iconPrefix === 'faction' ? factionIconSize : iconSize}px`,
          }"
        />
      </button>
    </div>

    <!-- Tooltip -->
    <Teleport to="body">
      <TooltipPopup
        v-if="hoveredOption && hoveredElement"
        :target-element="hoveredElement"
        variant="simple"
      >
        <template #content>{{ i18n.t(`game.${hoveredOption}`) }}</template>
      </TooltipPopup>
    </Teleport>
  </div>
</template>

<style scoped>
.icon-filter {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  align-items: center;
}

.icon-options {
  display: flex;
  gap: var(--spacing-xs);
  flex-wrap: wrap;
  justify-content: center;
}

.icon-option {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 4px solid transparent;
  border-radius: 50%;
  background-color: transparent;
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 2px;
}

.icon-option:hover {
  transform: scale(1.15);
}

.icon-option:active {
  transform: scale(0.95);
}

.icon-option.active {
  border-color: var(--active-border-color, var(--color-bg-white));
}

.clear-option {
  border-width: 0;
  color: var(--color-text-secondary);
}

.clear-option:hover,
.clear-option.active {
  color: var(--color-primary);
}

/* The active underline sits under the word, not on the button's bottom edge,
   where "All" would read as bottom-aligned beside the icons. The matching top
   border keeps the bare word on the icons' centre line. */
.clear-label {
  padding: 3px 1px;
  border-block: 2px solid transparent;
  font-weight: 700;
  line-height: 1;
  user-select: none;
  transition: translate var(--transition-fast);
}

/* An optical correction: with the underline showing, the pair looks low at
   the word's true centre, so both are lifted. */
.clear-option.active .clear-label {
  border-bottom-color: var(--active-border-color, var(--color-bg-white));
  translate: 0 -2px;
}

.filter-icon {
  object-fit: contain;
}
</style>
