<script setup lang="ts">
import { computed } from 'vue'

import MapButtons from '@/components/grid/MapButtons.vue'
import { useSelectionState } from '@/composables/useSelectionState'
import { DUEL_MAP_NAMES } from '@/lib/hd/maps'
import { useDuelBoard } from '@/stores/duelBoard'
import { useGrids } from '@/stores/grids'

const grids = useGrids()
const duelBoard = useDuelBoard()
const { clearTargetHex } = useSelectionState()

const maps = computed(() =>
  DUEL_MAP_NAMES.map(({ key, name }) => ({
    key,
    label: name,
    selected: grids.active?.currentMap === key,
  })),
)

// A tile tapped before may be another side's on the new map, or hold a unit.
const select = (map: string): void => {
  if (duelBoard.moveToMap(map)) clearTargetHex()
}
</script>

<template>
  <MapButtons :maps @select="select" />
</template>
