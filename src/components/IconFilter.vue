<script setup lang="ts">
import { ref, computed } from 'vue'

import { useI18nStore } from '../stores/i18n'
import Tooltip from './Tooltip.vue'

const i18n = useI18nStore()

interface Props {
  options: string[]
  modelValue: string
  iconPrefix: string // e.g., 'class', 'faction', 'damage'
  icons: Readonly<Record<string, string>>
}

interface Emits {
  (e: 'update:modelValue', value: string): void
}

const props = defineProps<Props>()
defineEmits<Emits>()

const getIconPath = (iconPrefix: string, option: string): string => {
  const iconKey = `${iconPrefix}-${option}`
  return props.icons[iconKey] || ''
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
  hoveredElement.value = event.currentTarget as HTMLElement
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
        @click="$emit('update:modelValue', '')"
        @mouseenter="handleMouseEnter('show-all', $event)"
        @mouseleave="handleMouseLeave"
      >
        <svg viewBox="0 0 24 24" class="all-icon">
          <!-- Asterisk with 6 rays for more elegance -->
          <g transform="translate(12, 12)">
            <!-- Vertical line -->
            <line
              x1="0"
              y1="-5.5"
              x2="0"
              y2="5.5"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
            <!-- 60 degree line -->
            <line
              x1="-4.76"
              y1="-2.75"
              x2="4.76"
              y2="2.75"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
            <!-- 120 degree line -->
            <line
              x1="-4.76"
              y1="2.75"
              x2="4.76"
              y2="-2.75"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
            <!-- Optional: Add a small center dot for style -->
            <circle
              cx="0"
              cy="0"
              r="1.2"
              fill="currentColor"
            />
          </g>
        </svg>
      </button>

      <!-- Icon options -->
      <button
        v-for="option in options"
        :key="option"
        :class="['icon-option', { active: modelValue === option }]"
        @click="$emit('update:modelValue', option)"
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
      <Tooltip
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
  border: 4px solid white;
  border-radius: 50%;
  background-color: transparent;
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 2px;
}

.icon-option:hover {
  border-color: #ccc;
  transform: scale(1.05);
}

.icon-option.active {
  border-color: #999;
}

.clear-option {
  color: var(--color-text-secondary);
}

.clear-option:hover {
  color: var(--color-primary);
  border-color: #ccc;
}

.clear-option.active {
  color: var(--color-primary);
  border-color: #999;
  background-color: var(--color-primary-light);
}

.all-icon {
  width: 20px;
  height: 20px;
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
