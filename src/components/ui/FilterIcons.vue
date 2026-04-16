<script setup lang="ts">
import { computed, ref } from 'vue'

import TooltipPopup from './TooltipPopup.vue'
import { CLASS_ORDER, compareByOrder, FACTION_ORDER } from '@/lib/filterOrder'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'

const gameDataStore = useGameDataStore()
const i18n = useI18nStore()

interface Props {
  options: string[]
  iconPrefix: string // e.g., 'class', 'faction', 'damage'
  size?: number // button size in px (default 36)
  showTooltip?: boolean
  activeBorderColor?: string // CSS color for the selected icon's border
}

const props = withDefaults(defineProps<Props>(), {
  size: 36,
  showTooltip: true,
  activeBorderColor: 'var(--color-bg-white)',
})
const modelValue = defineModel<string>({ required: true })

const iconSize = computed(() => Math.round(props.size * 0.78))
const factionIconSize = computed(() => Math.round(props.size * 0.89))
const borderWidth = computed(() => (props.size >= 36 ? 4 : 3))
// "All" is a text button, not a portrait — keep its underline slimmer than
// the icon borders so it reads as a delicate accent.
const clearBorderWidth = computed(() => (props.size >= 36 ? 2 : 2))

const PREFIX_ORDERS: Record<string, readonly string[]> = {
  faction: FACTION_ORDER,
  class: CLASS_ORDER,
}

const orderedOptions = computed(() => {
  const order = PREFIX_ORDERS[props.iconPrefix]
  if (!order) return props.options
  return [...props.options].sort((a, b) => compareByOrder(a, b, order))
})

const getIconPath = (iconPrefix: string, option: string): string => {
  const iconKey = `${iconPrefix}-${option}`
  return gameDataStore.getIcon(iconKey)
}

// Tooltip state
const hoveredOption = ref<string | null>(null)
const hoveredElement = ref<HTMLElement | null>(null)

const handleMouseEnter = (option: string, event: MouseEvent) => {
  if (!props.showTooltip) return
  hoveredOption.value = option
  if (event.currentTarget instanceof HTMLElement) {
    hoveredElement.value = event.currentTarget
  }
}

const handleMouseLeave = () => {
  if (!props.showTooltip) return
  hoveredOption.value = null
  hoveredElement.value = null
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
          borderWidth: modelValue === '' ? `${clearBorderWidth}px 0` : '0',
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
      >
        <img
          :src="getIconPath(iconPrefix, option)"
          :alt="option"
          :class="['filter-icon', { 'dark-bg': iconPrefix === 'damage' }]"
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
        :text="i18n.t(`game.${hoveredOption}`)"
        :target-element="hoveredElement"
        variant="simple"
      />
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
  color: var(--color-text-secondary);
}

.clear-option:hover {
  color: var(--color-primary);
}

.clear-option.active {
  color: var(--color-primary);
  border-style: solid;
  border-top-color: transparent;
  border-bottom-color: var(--active-border-color, var(--color-bg-white));
  border-radius: 0;
}

.clear-label {
  font-weight: 700;
  line-height: 1;
  user-select: none;
}

.filter-icon {
  object-fit: contain;
  border-radius: var(--radius-sm);
}

.filter-icon.dark-bg {
  background-color: rgba(0, 0, 0, 0.6);
  padding: 2px;
  border-radius: 50%;
}
</style>
