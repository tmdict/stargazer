<script setup lang="ts">
import { computed } from 'vue'

import DropdownSelect, { type DropdownItem } from '@/components/ui/DropdownSelect.vue'
import { useArenaPick } from '@/composables/useArenaPick'
import { TEAM_VARIANTS } from '@/lib/teams/modes'
import { useGrids } from '@/stores/grids'
import { useI18nStore } from '@/stores/i18n'

const grids = useGrids()
const i18nStore = useI18nStore()
const arenaPick = useArenaPick()

// A quick-select slot would move the Arena board, which is not on screen
// while an Honor Duel board is. That board's maps are in its own tab.
const onArena = computed(() => grids.active?.kind !== 'honorDuel')

// Quick-select slots: one row per map of every registered team type, so a
// season rotation in the registry updates the entries by itself. One map can
// back several slots (SL Arena 1 and GD Arena 1 are both arena1), so entries
// key by label.
const quickMaps = computed(() => {
  const arena = i18nStore.t('app.arena')
  return Object.values(TEAM_VARIANTS).flatMap((variant) =>
    variant.maps.map((key, i) => ({
      label: `${variant.key.toUpperCase()} ${arena} ${i + 1}`,
      mode: variant.key,
      key,
    })),
  )
})

// The row picked names the trigger while the board stays on its map; a board
// on a plain map (a Maps tab pick, an edited map, a link) shows the generic
// label.
const picked = computed(() => {
  const pick = grids.arenaPick
  if (!pick || grids.active?.currentMap !== pick.map) return undefined
  return quickMaps.value.find((m) => m.mode === pick.mode && m.key === pick.map)
})

const items = computed((): DropdownItem[] =>
  quickMaps.value.map((m) => ({
    key: m.label,
    label: m.label,
    selected: m === picked.value,
  })),
)

const select = (key: string): void => {
  const row = quickMaps.value.find((m) => m.label === key)
  if (row) arenaPick.pick(row.mode, row.key)
}
</script>

<template>
  <DropdownSelect
    v-if="onArena"
    class="arena-dropdown"
    variant="tab"
    :label="picked?.label ?? i18nStore.t('app.arena')"
    :items
    @select="select"
  />
</template>

<style scoped>
.arena-dropdown {
  display: none;
}

@media (min-width: 1320px) {
  .arena-dropdown {
    display: block;
  }
}
</style>
