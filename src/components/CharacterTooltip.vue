<script setup lang="ts">
/* Hover tooltip for a character, shared by the roster icon (CharacterIcon) and the
   placed grid icons (GridCharacters). The caller decides when to show it and supplies
   the anchor element; this owns the popup body (name only, or the full stat card). */

import { computed } from 'vue'

import TooltipPopup from './ui/TooltipPopup.vue'
import type { CharacterType } from '@/lib/types/character'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import { localizedDisplayName } from '@/utils/nameFormatting'

const { character, variant = 'detailed' } = defineProps<{
  character: CharacterType
  targetElement: HTMLElement
  variant?: 'simple' | 'detailed'
}>()

const gameDataStore = useGameDataStore()
const i18n = useI18nStore()

const formattedName = computed(() => localizedDisplayName(i18n.t, 'character', character.name))
const damageIcon = computed(() => gameDataStore.getIcon(`damage-${character.damage}`))
const energyIcon = computed(() => gameDataStore.getIcon('initial-energy'))

// "base (bonus)" when a skill grants extra starting energy; else just the base.
const formattedEnergy = computed(() => {
  const [base = 0, ...bonuses] = character.energy
  if (bonuses.length === 0) return String(base)
  return `${base} (${bonuses.reduce((sum, n) => sum + n, 0)})`
})
</script>

<template>
  <Teleport to="body">
    <TooltipPopup :target-element="targetElement" :variant="variant" :offset="10">
      <template #content>
        <div v-if="variant === 'simple'" class="simple-tooltip">{{ formattedName }}</div>

        <template v-else>
          <div class="tooltip-header">
            <h3>{{ formattedName }}</h3>
          </div>

          <div class="tooltip-content">
            <div class="tooltip-row">
              <img
                :src="gameDataStore.getIcon(`faction-${character.faction}`)"
                :alt="character.faction"
                class="tooltip-icon"
              />
              <span class="tooltip-label">{{ i18n.t('game.faction') }}:</span>
              <span class="tooltip-value">{{ i18n.t(`game.${character.faction}`) }}</span>
            </div>

            <div class="tooltip-row">
              <img
                :src="gameDataStore.getIcon(`class-${character.class}`)"
                :alt="character.class"
                class="tooltip-icon"
              />
              <span class="tooltip-label">{{ i18n.t('game.class') }}:</span>
              <span class="tooltip-value">{{ i18n.t(`game.${character.class}`) }}</span>
            </div>

            <div class="tooltip-row">
              <img
                v-if="damageIcon"
                :src="damageIcon"
                :alt="String(character.damage)"
                class="tooltip-icon"
              />
              <span class="tooltip-label">{{ i18n.t('game.damage') }}:</span>
              <span class="tooltip-value">{{ i18n.t(`game.${character.damage}`) }}</span>
            </div>

            <div class="tooltip-row">
              <img
                v-if="energyIcon"
                :src="energyIcon"
                :alt="formattedEnergy"
                class="tooltip-icon energy-icon"
              />
              <span class="tooltip-label">{{ i18n.t('game.energy') }}:</span>
              <span class="tooltip-value">{{ formattedEnergy }}</span>
            </div>

            <div class="tooltip-row">
              <span class="tooltip-label">{{ i18n.t('game.range') }}:</span>
              <span class="tooltip-value">{{ character.range }}</span>
            </div>

            <div class="tooltip-row">
              <span class="tooltip-label">{{ i18n.t('game.season') }}:</span>
              <span class="tooltip-value">{{ character.season }}</span>
            </div>
          </div>
        </template>
      </template>
    </TooltipPopup>
  </Teleport>
</template>

<style scoped>
.simple-tooltip {
  font-size: 14px;
  font-weight: 600;
  text-align: center;
  white-space: nowrap;
}

.tooltip-header {
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.tooltip-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  text-align: center;
}

.tooltip-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tooltip-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.tooltip-icon {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.2);
  flex-shrink: 0;
}

.tooltip-icon.energy-icon {
  filter: brightness(1.5);
}

.tooltip-label {
  color: rgba(255, 255, 255, 0.7);
  min-width: 60px;
}

.tooltip-value {
  font-weight: 500;
  text-transform: capitalize;
}

/* Rows without an icon align their label to where the icon-bearing ones start. */
.tooltip-row:not(:has(.tooltip-icon)) .tooltip-label {
  margin-left: 28px;
}
</style>
