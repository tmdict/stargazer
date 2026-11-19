<script setup lang="ts">
/* The Arena board's map: a button for each board of every team type's list,
   so a season rotation in the registry updates them by itself. A pick moves
   the board onto that map with the buffs it has on that list. */

import { computed } from 'vue'

import MapButtons from './MapButtons.vue'
import { useArenaPick } from '@/composables/useArenaPick'
import { TEAM_VARIANTS } from '@/lib/teams/modes'
import { useGrids } from '@/stores/grids'

const grids = useGrids()
const arenaPick = useArenaPick()

// One map can be on two lists (SL1 and GD1 are both arena1), so a button is
// known by its label.
const slots = Object.values(TEAM_VARIANTS).flatMap((variant) =>
  variant.maps.map((map, index) => ({
    label: `${variant.key.toUpperCase()}${index + 1}`,
    mode: variant.key,
    map,
  })),
)

// A button stays lit while the board stays on its map; a board on a plain map
// (a Maps tab pick, an edited map, a link) lights none.
const maps = computed(() => {
  const pick = grids.arenaPick
  const held = pick !== null && grids.active?.currentMap === pick.map ? pick : null
  return slots.map(({ label, mode, map }) => ({
    key: label,
    label,
    selected: held?.mode === mode && held.map === map,
  }))
})

const select = (label: string): void => {
  const slot = slots.find((entry) => entry.label === label)
  if (slot) arenaPick.pick(slot.mode, slot.map)
}
</script>

<template>
  <MapButtons :maps dense @select="select" />
</template>
