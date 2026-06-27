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

const hasActiveFilter = computed(
  () =>
    factionFilter.value !== '' ||
    classFilter.value !== '' ||
    damageFilter.value !== '' ||
    tagFilter.value !== null,
)

// Clicks on the strip background (gaps, between rows) clear every filter.
// FilterIcons + FilterPills render their options as <button>s, so a closest()
// check skips any click that actually landed on a filter.
function handleStripClick(e: MouseEvent) {
  if (!hasActiveFilter.value) return
  if ((e.target as HTMLElement).closest('button')) return
  factionFilter.value = ''
  classFilter.value = ''
  damageFilter.value = ''
  tagFilter.value = null
}
</script>

<template>
  <div class="filter-strip" :class="{ resettable: hasActiveFilter }" @click="handleStripClick">
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
        class="filter-damage"
      />
    </div>
    <TagsDisplay v-model="tagFilter" :characters class="filter-tags" />
  </div>
</template>

<style scoped>
.filter-strip {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.filter-strip.resettable {
  cursor: pointer;
}

.filters-row {
  display: flex;
  gap: var(--spacing-md);
  align-items: end;
  flex-wrap: wrap;
}

.filter-strip :deep(.filter-tags .pill) {
  padding: 3px var(--spacing-md);
  line-height: 1.4;
}

.filter-strip :deep(.filter-tags .pill.selected) {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
}

@media (max-width: 768px) {
  .filters-row {
    gap: var(--spacing-sm);
    flex-direction: column;
    align-items: stretch;
  }
  /* Tag chips ("Energy Recharge", etc.) and the magic/physical damage filter
     are hidden on mobile to save space. The roster's only mobile surface is
     the skills sheet. Scoped under their parents so these win the specificity
     tie against the children's own `display` rules regardless of bundle order. */
  .filter-strip .filter-tags,
  .filters-row .filter-damage {
    display: none;
  }
}
</style>
