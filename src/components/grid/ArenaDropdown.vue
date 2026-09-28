<script setup lang="ts">
import { computed } from 'vue'

import DropdownSelect, { type DropdownItem } from '@/components/ui/DropdownSelect.vue'
import { TEAM_VARIANTS } from '@/lib/teams/modes'
import { useGridStore } from '@/stores/grid'
import { useI18nStore } from '@/stores/i18n'

const gridStore = useGridStore()
const i18nStore = useI18nStore()

// Quick-select slots: one row per map of every registered team type, so a
// season rotation in the registry updates the entries by itself. One map can
// back several slots (SL Arena 1 and GD Arena 1 are both arena1), so entries
// key by label and every slot backed by the current map highlights.
const quickMaps = computed(() => {
  const arena = i18nStore.t('app.arena')
  return Object.values(TEAM_VARIANTS).flatMap((variant) =>
    variant.maps.map((key, i) => ({
      label: `${variant.key.toUpperCase()} ${arena} ${i + 1}`,
      key,
    })),
  )
})

// The first matching slot names the trigger; a map picked outside this list
// (the Maps tab offers every preset) falls back to the generic label.
const currentLabel = computed(
  () => quickMaps.value.find((m) => m.key === gridStore.currentMap)?.label,
)

const items = computed((): DropdownItem[] =>
  quickMaps.value.map((m) => ({
    key: m.label,
    label: m.label,
    selected: m.key === gridStore.currentMap,
  })),
)

const select = (label: string): void => {
  const map = quickMaps.value.find((m) => m.label === label)
  if (map) gridStore.switchMap(map.key)
}
</script>

<template>
  <DropdownSelect
    class="arena-dropdown"
    variant="tab"
    :label="currentLabel ?? i18nStore.t('app.arena')"
    :items
    @select="select"
  />
</template>

<style scoped>
/* Desktop-only quick switcher; below 1320px the Map Editor tab is the arena picker. */
.arena-dropdown {
  display: none;
}

@media (min-width: 1320px) {
  .arena-dropdown {
    display: block;
  }
}
</style>
