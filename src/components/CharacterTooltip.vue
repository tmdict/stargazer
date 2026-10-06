<script setup lang="ts">
/* Hover tooltip for a character, shared by the picker icon (CharacterIcon) and the
   placed grid icons (GridCharacters). The caller decides when to show it and supplies
   the anchor element; this owns the popup body (name only, or the full stat card). */

import { computed } from 'vue'

import TooltipCard from './ui/TooltipCard.vue'
import TooltipPopup from './ui/TooltipPopup.vue'
import { addedEnergy, ownEnergy } from '@/lib/mechanics'
import type { CharacterType } from '@/lib/types/character'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import { characterDisplayName } from '@/utils/nameFormatting'

const { character, variant = 'detailed' } = defineProps<{
  character: CharacterType
  targetElement: HTMLElement
  variant?: 'simple' | 'detailed'
  hint?: string
}>()

const gameDataStore = useGameDataStore()
const i18n = useI18nStore()

const formattedName = computed(() => characterDisplayName(i18n.t, character))

const formattedEnergy = computed(() => {
  const added = addedEnergy(character)
  return added > 0 ? `${ownEnergy(character)} (${added})` : String(ownEnergy(character))
})

const rows = computed(() => [
  {
    label: `${i18n.t('game.faction')}:`,
    value: i18n.t(`game.${character.faction}`),
    icon: gameDataStore.getIcon(`faction-${character.faction}`),
  },
  {
    label: `${i18n.t('game.class')}:`,
    value: i18n.t(`game.${character.class}`),
    icon: gameDataStore.getIcon(`class-${character.class}`),
  },
  {
    label: `${i18n.t('game.damage')}:`,
    value: i18n.t(`game.${character.damage}`),
    icon: gameDataStore.getIcon(`damage-${character.damage}`),
  },
  {
    label: `${i18n.t('game.energy')}:`,
    value: formattedEnergy.value,
    icon: gameDataStore.getIcon('initial-energy'),
    iconClass: 'energy-icon',
  },
  { label: `${i18n.t('game.range')}:`, value: character.range },
  { label: `${i18n.t('game.season')}:`, value: character.season },
])
</script>

<template>
  <Teleport to="body">
    <TooltipPopup :target-element="targetElement" :variant="variant">
      <template #content>
        <!-- Placeholders have no stats; name-only regardless of variant. -->
        <div v-if="variant === 'simple' || character.placeholder" class="simple-tooltip">
          {{ formattedName }}
        </div>
        <TooltipCard v-else :name="formattedName" :rows :hint />
      </template>
    </TooltipPopup>
  </Teleport>
</template>

<style scoped>
.simple-tooltip {
  font-weight: 600;
  text-align: center;
  white-space: nowrap;
}

/* The energy icon is darker than the others. */
:deep(.energy-icon) {
  filter: brightness(1.5);
}
</style>
