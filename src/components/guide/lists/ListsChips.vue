<script setup lang="ts">
/* A row of hero chips for some of the groups: range and damage by name,
   class and faction by icon. */

import { useGameDataStore } from '@/stores/gameData'
import { HERO_CHIPS, type ChipGroup } from './heroChips'
import { useListWords } from './useListEditor'

defineProps<{ groups: ChipGroup[] }>()

const chosen = defineModel<Set<string>>({ required: true })

const gameData = useGameDataStore()
const { t, game } = useListWords()

const label = (group: ChipGroup, value: string): string =>
  group === 'range' ? t(`lists-${value}`) : game(value)

const iconOnly = (group: ChipGroup): boolean => group === 'class' || group === 'faction'

function toggle(id: string): void {
  const next = new Set(chosen.value)
  if (!next.delete(id)) next.add(id)
  chosen.value = next
}
</script>

<template>
  <template v-for="group in groups" :key="group">
    <button
      v-for="value in HERO_CHIPS[group]"
      :key="value"
      type="button"
      class="lists-chip"
      :class="{ icon: iconOnly(group) }"
      :aria-pressed="chosen.has(`${group}:${value}`)"
      :title="iconOnly(group) ? label(group, value) : undefined"
      :aria-label="iconOnly(group) ? label(group, value) : undefined"
      @click="toggle(`${group}:${value}`)"
    >
      <img v-if="group !== 'range'" :src="gameData.getIcon(`${group}-${value}`)" alt="" />
      <template v-if="!iconOnly(group)">{{ label(group, value) }}</template>
    </button>
  </template>
</template>
