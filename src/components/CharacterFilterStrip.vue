<script setup lang="ts">
import { computed } from 'vue'

import CharacterFilterMechanics from './CharacterFilterMechanics.vue'
import FilterIcons from './ui/FilterIcons.vue'
import { PLACEHOLDER_NONE } from '@/lib/characters/placeholder'
import type { CharacterType } from '@/lib/types/character'
import type { TagPick } from '@/lib/types/skill'

const factionFilter = defineModel<string>('factionFilter', { default: '' })
const classFilter = defineModel<string>('classFilter', { default: '' })
const tagFilter = defineModel<TagPick | null>('tagFilter', { default: null })

const props = defineProps<{
  characters: readonly CharacterType[]
  // `characters` with the icon filters applied: what the tag menu counts in.
  tagPool: readonly CharacterType[]
}>()

const optionsOf = (pick: (c: CharacterType) => string) =>
  [...new Set(props.characters.map(pick))].filter((v) => v !== PLACEHOLDER_NONE).sort()

const factionOptions = computed(() => optionsOf((c) => c.faction))
const classOptions = computed(() => optionsOf((c) => c.class))

const hasActiveFilter = computed(
  () => factionFilter.value !== '' || classFilter.value !== '' || tagFilter.value !== null,
)

// Clicks on the strip background (gaps, between rows) clear every filter.
// The filters render their options as <button>s, so a closest() check skips
// any click that actually landed on one. While a dropdown in the strip is
// open, a click outside it is only its dismissal; the host's dropdowns are
// slot content, so the open one is found by its trigger's aria-expanded.
function handleStripClick(e: MouseEvent) {
  if (!hasActiveFilter.value) return
  if ((e.currentTarget as HTMLElement).querySelector('[aria-expanded="true"]')) return
  if ((e.target as HTMLElement).closest('button')) return
  factionFilter.value = ''
  classFilter.value = ''
  tagFilter.value = null
}
</script>

<template>
  <div class="filter-strip" :class="{ resettable: hasActiveFilter }" @click="handleStripClick">
    <div class="menus-row">
      <slot name="menus" />
      <CharacterFilterMechanics v-model="tagFilter" :pool="tagPool" />
    </div>
    <div class="icons-row">
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
    </div>
  </div>
</template>

<style scoped>
.filter-strip {
  display: flex;
  flex-direction: column;
  gap: var(--picker-row-gap);
}

.filter-strip.resettable {
  cursor: pointer;
}

.icons-row {
  display: flex;
  gap: var(--spacing-md);
  align-items: center;
  flex-wrap: wrap;
}

.menus-row {
  display: flex;
  gap: var(--spacing-md);
  align-items: center;
  flex-wrap: wrap;
}

@media (max-width: 768px) {
  .icons-row {
    gap: var(--spacing-sm);
    flex-direction: column;
    align-items: stretch;
  }

  .menus-row {
    padding: 0 var(--filter-inset, 0);
  }

  /* `.large` outranks the width each dropdown sets for wide screens. */
  .menus-row :deep(.dropdown.large) {
    flex: 1;
    min-width: 0;
    --dropdown-trigger-width: 100%;
    --dropdown-trigger-min-width: 0;
  }
}
</style>
