<script setup lang="ts">
/* The 5 v 5 roster: a separate card on desktop, a pull-up sheet over the grids on
   mobile. Its tabs (characters / seasonal / maps) act on the active board. The
   mobile tap flow drives the sheet, so the selection watches + sheet state live
   here alongside the BottomSheet they control: a targeted cell opens it on
   Characters, an on-grid artifact opens it on Seasonal, lifting a hero collapses it. */

import { computed, ref, watch } from 'vue'

import CharacterSelection from '@/components/CharacterSelection.vue'
import ArenaPreviewGrid from '@/components/grid/ArenaPreviewGrid.vue'
import MapInvertToggle from '@/components/MapInvertToggle.vue'
import SeasonalSelection from '@/components/SeasonalSelection.vue'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import TabView from '@/components/ui/TabView.vue'
import { useSelectionState } from '@/composables/useSelectionState'
import type { ArtifactType } from '@/lib/types/artifact'
import type { CharacterType } from '@/lib/types/character'
import type { PhantimalType } from '@/lib/types/phantimal'
import { useGridStore } from '@/stores/grid'
import { useI18nStore } from '@/stores/i18n'

defineProps<{
  characters: readonly CharacterType[]
  artifacts: readonly ArtifactType[]
  phantimals: readonly PhantimalType[]
}>()

const i18n = useI18nStore()
const gridStore = useGridStore()
const { targetHexId, tabRequest, liftedHexId, clearTargets } = useSelectionState()

const activeTab = ref('characters')
const tabs = computed(() => [
  { key: 'characters', label: i18n.t('app.characters') },
  { key: 'seasonal', label: i18n.t('app.seasonal') },
  { key: 'maps', label: i18n.t('app.maps') },
])

const sheetExpanded = ref(false)

// Tapping a cell targets it: open the sheet on Characters; placing clears the
// target and collapses it so the board result shows. An on-grid artifact tap
// requests the Seasonal tab; lifting a hero collapses the sheet to free the board.
watch(targetHexId, (id) => {
  if (id !== null) {
    activeTab.value = 'characters'
    sheetExpanded.value = true
  } else {
    sheetExpanded.value = false
  }
})
watch(tabRequest, (req) => {
  if (!req) return
  activeTab.value = req.tab
  sheetExpanded.value = true
})
watch(liftedHexId, (id) => {
  if (id !== null) sheetExpanded.value = false
})

// Preset selection retargets the active board's map.
const handleArenaSelected = (mapKey: string) => {
  gridStore.switchMap(mapKey)
}
</script>

<template>
  <BottomSheet v-model:expanded="sheetExpanded" :desktop-rail="false" @dismiss="clearTargets">
    <TabView v-model="activeTab" :tabs="tabs" fill eager>
      <template #characters>
        <CharacterSelection :characters="characters" :is-draggable="true" :scrollable="false" />
      </template>
      <template #seasonal>
        <SeasonalSelection
          :artifacts="artifacts"
          :phantimals="phantimals"
          :is-draggable="true"
          :scrollable="false"
        />
      </template>
      <template #maps>
        <div class="maps-tab">
          <MapInvertToggle />
          <ArenaPreviewGrid @arena-selected="handleArenaSelected" />
        </div>
      </template>
    </TabView>
  </BottomSheet>
</template>

<style scoped>
.maps-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-lg);
}
</style>
