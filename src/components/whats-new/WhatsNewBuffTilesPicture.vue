<script setup lang="ts">
/* A Supreme League map without Grid Info and with it, which marks the map's
   buff tiles. */

import BoardThumbnail from '@/components/grid/BoardThumbnail.vue'
import HelpMock from '@/components/help/HelpMock.vue'
import HelpScene from '@/components/help/HelpScene.vue'
import HelpToggle from '@/components/help/HelpToggle.vue'
import { useHelpLocale } from '@/composables/useHelpLocale'
import { buffTilesOf, MODE_BOARDS } from '@/lib/mapModeLists'
import { appLabel } from '@/utils/skillLabels'

const lang = useHelpLocale()

// Not every board of the list has buff tiles.
const BOARD = MODE_BOARDS.sl.find((board) => board.buffs?.length) ?? MODE_BOARDS.sl[0]!

const STATES = [
  { slot: 'from', on: false, buffTiles: [] },
  { slot: 'to', on: true, buffTiles: buffTilesOf(BOARD.buffs ?? []) },
] as const
</script>

<template>
  <HelpScene>
    <template v-for="state in STATES" :key="state.slot" #[state.slot]>
      <HelpMock :caption="appLabel('arena', lang)">
        <div class="help-mock-bar centered">
          <HelpToggle :label="appLabel('grid-info', lang)" :on="state.on" split />
        </div>
        <BoardThumbnail class="board" :map-key="BOARD.map" :buff-tiles="state.buffTiles" />
      </HelpMock>
    </template>
  </HelpScene>
</template>

<style scoped>
.board {
  display: block;
  width: 220px;
  margin: 0 auto;
}
</style>
