<script setup lang="ts">
import { computed, ref } from 'vue'

import IconFilterAll from './IconFilterAll.vue'
import TooltipPopup from './TooltipPopup.vue'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'

const gameDataStore = useGameDataStore()
const i18n = useI18nStore()

interface Props {
  options: string[]
  iconPrefix: string // e.g., 'class', 'faction', 'damage'
}

defineProps<Props>()
const modelValue = defineModel<string>({ required: true })

const getIconPath = (iconPrefix: string, option: string): string => {
  const iconKey = `${iconPrefix}-${option}`
  return gameDataStore.getIcon(iconKey)
}

// Tooltip state
const hoveredOption = ref<string | null>(null)
const hoveredElement = ref<HTMLElement | null>(null)

const getTooltipText = computed(() => {
  if (!hoveredOption.value) return ''

  if (hoveredOption.value === 'show-all') {
    return i18n.t('app.show-all')
  }

  // For faction, class, damage options, use game translations
  return i18n.t(`game.${hoveredOption.value}`)
})

const handleMouseEnter = (option: string, event: MouseEvent) => {
  hoveredOption.value = option
  if (event.currentTarget instanceof HTMLElement) {
    hoveredElement.value = event.currentTarget
  }
}

const handleMouseLeave = () => {
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
        @click="modelValue = ''"
        @mouseenter="handleMouseEnter('show-all', $event)"
        @mouseleave="handleMouseLeave"
      >
        <IconFilterAll :size="20" />
      </button>

      <!-- Icon options -->
      <button
        v-for="option in options"
        :key="option"
        :class="['icon-option', { active: modelValue === option }]"
        @click="modelValue = modelValue === option ? '' : option"
        @mouseenter="handleMouseEnter(option, $event)"
        @mouseleave="handleMouseLeave"
      >
        <img
          :src="getIconPath(iconPrefix, option)"
          :alt="option"
          :class="[
            'filter-icon',
            { 'dark-bg': iconPrefix === 'damage', 'faction-icon': iconPrefix === 'faction' },
          ]"
        />
      </button>
    </div>

    <!-- Tooltip -->
    <Teleport to="body">
      <TooltipPopup
        v-if="hoveredOption && hoveredElement"
        :text="getTooltipText"
        :targetElement="hoveredElement"
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
  width: 36px;
  height: 36px;
  border: 4px solid #fff;
  border-radius: 50%;
  background-color: transparent;
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 2px;
}

.icon-option:hover {
  border-color: var(--color-primary-hover);
  transform: scale(1.05);
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
  border-color: var(--color-primary-hover);
}

.clear-option.active {
  color: var(--color-primary);
  border-color: var(--color-primary);
}

.filter-icon {
  width: 28px;
  height: 28px;
  object-fit: contain;
  border-radius: var(--radius-sm);
}

.filter-icon.dark-bg {
  background-color: rgba(0, 0, 0, 0.6);
  padding: 2px;
  border-radius: 50%;
}

.filter-icon.faction-icon {
  width: 32px;
  height: 32px;
}

@media (max-width: 768px) {
  .icon-option {
    width: 32px;
    height: 32px;
  }

  .filter-icon {
    width: 24px;
    height: 24px;
  }

  .filter-icon.faction-icon {
    width: 28px;
    height: 28px;
  }
}
</style>
