<script setup lang="ts">
import { computed } from 'vue'

import TagsDisplay from './TagsDisplay.vue'
import FilterIcons from './ui/FilterIcons.vue'
import type { CharacterType } from '@/lib/types/character'

const factionFilter = defineModel<string>('factionFilter', { default: '' })
const classFilter = defineModel<string>('classFilter', { default: '' })
const damageFilter = defineModel<string>('damageFilter', { default: '' })
const tagFilter = defineModel<string | null>('tagFilter', { default: null })

const props = defineProps<{ characters: readonly CharacterType[] }>()

const factionOptions = computed(() => [...new Set(props.characters.map((c) => c.faction))].sort())
const classOptions = computed(() => [...new Set(props.characters.map((c) => c.class))].sort())
const damageOptions = computed(() => [...new Set(props.characters.map((c) => c.damage))].sort())
</script>

<template>
  <div class="filter-strip">
    <div class="filters-row">
      <FilterIcons
        v-model="factionFilter"
        icon-prefix="faction"
        :options="factionOptions"
        active-border-color="var(--color-primary)"
      />
      <FilterIcons
        v-model="classFilter"
        icon-prefix="class"
        :options="classOptions"
        active-border-color="var(--color-primary)"
      />
      <FilterIcons
        v-model="damageFilter"
        icon-prefix="damage"
        :options="damageOptions"
        active-border-color="var(--color-primary)"
      />
    </div>
    <TagsDisplay v-model="tagFilter" :characters />
  </div>
</template>

<style scoped>
.filter-strip {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
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
