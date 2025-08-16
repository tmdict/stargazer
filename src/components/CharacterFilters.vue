<script setup lang="ts">
import { computed } from 'vue'

import IconFilter from './ui/IconFilter.vue'
import type { CharacterType } from '../lib/types/character'

interface Props {
  characters: readonly CharacterType[]
  icons: Readonly<Record<string, string>>
  factionFilter: string
  classFilter: string
  damageFilter: string
}

interface Emits {
  (e: 'update:factionFilter', value: string): void
  (e: 'update:classFilter', value: string): void
  (e: 'update:damageFilter', value: string): void
}

const props = defineProps<Props>()
defineEmits<Emits>()

// Extract unique values for each filter
const factionOptions = computed(() => {
  const factions = [...new Set(props.characters.map((char) => char.faction))]
  return factions.sort()
})

const classOptions = computed(() => {
  const classes = [...new Set(props.characters.map((char) => char.class))]
  return classes.sort()
})

const damageOptions = computed(() => {
  const damages = [...new Set(props.characters.map((char) => char.damage))]
  return damages.sort()
})
</script>

<template>
  <div class="character-filters">
    <div class="filters-row">
      <IconFilter
        iconPrefix="faction"
        :icons
        :options="factionOptions"
        :modelValue="factionFilter"
        @update:modelValue="$emit('update:factionFilter', $event)"
      />
      <IconFilter
        iconPrefix="class"
        :icons
        :options="classOptions"
        :modelValue="classFilter"
        @update:modelValue="$emit('update:classFilter', $event)"
      />
      <IconFilter
        iconPrefix="damage"
        :icons
        :options="damageOptions"
        :modelValue="damageFilter"
        @update:modelValue="$emit('update:damageFilter', $event)"
      />
    </div>
  </div>
</template>

<style scoped>
.character-filters {
  display: contents;
}

.filters-row {
  display: flex;
  gap: var(--spacing-md);
  align-items: end;
  flex-wrap: wrap;
}

@media (max-width: 768px) {
  .filters-row {
    gap: var(--spacing-sm);
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
