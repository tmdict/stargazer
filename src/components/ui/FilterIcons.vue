<script setup lang="ts">
import { computed, ref } from 'vue'

import TooltipPopup from './TooltipPopup.vue'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'

const gameDataStore = useGameDataStore()
const i18n = useI18nStore()

interface Props {
  options: string[]
  iconPrefix: string // e.g., 'class', 'faction', 'damage'
  size?: number // button size in px (default 36)
  showTooltip?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 36,
  showTooltip: true,
})
const modelValue = defineModel<string>({ required: true })

const iconSize = computed(() => Math.round(props.size * 0.78))
const factionIconSize = computed(() => Math.round(props.size * 0.89))
const borderWidth = computed(() => (props.size >= 36 ? 4 : 3))

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
        :style="{ width: `${size}px`, height: `${size}px`, borderWidth: '0' }"
        @click="modelValue = ''"
      >
        <span class="clear-label" :style="{ fontSize: `${Math.round(size * 0.39)}px` }">{{
          i18n.t('app.all')
        }}</span>
      </button>

      <!-- Icon options -->
      <button
        v-for="option in options"
        :key="option"
        :class="['icon-option', { active: modelValue === option }]"
        :style="{ width: `${size}px`, height: `${size}px`, borderWidth: `${borderWidth}px` }"
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
  border-color: #aaa;
}

.clear-option {
  color: var(--color-text-secondary);
}

.clear-option:hover {
  color: var(--color-primary);
}

.clear-option.active {
  color: var(--color-primary);
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
