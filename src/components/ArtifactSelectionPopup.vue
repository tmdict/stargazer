<script setup lang="ts">
import { computed } from 'vue'

import ArtifactSelectionPalette from './ArtifactSelectionPalette.vue'
import SelectionPopup from './ui/SelectionPopup.vue'
import { useGridContext } from '@/composables/useGridContext'
import type { ArtifactType } from '@/lib/types/artifact'
import type { Team } from '@/lib/types/team'
import { useGameDataStore } from '@/stores/gameData'
import { useGrids } from '@/stores/grids'

interface Props {
  // The team whose artifact slot the chosen artifact is placed into.
  team: Team
  position: { x: number; y: number }
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
}>()

const gameDataStore = useGameDataStore()
const grids = useGrids()
// The board that opened the popup (injected through GridArtifacts). Picks must
// land on this board, not the page-wide active board, which any interaction on
// another board can move while the popup is open.
const ctx = useGridContext()

// Pre-season first, then by id: mirrors the Seasonal tab ordering.
const sortedArtifacts = computed(() =>
  [...gameDataStore.artifacts].sort((a, b) => a.season - b.season || a.id - b.id),
)

// Drop artifacts already assigned to this team on any board (page-wide per-team
// uniqueness), like the character popup hides placed heroes.
const availableArtifacts = computed(() =>
  sortedArtifacts.value.filter((a) => !grids.isArtifactUsed(a.id, props.team)),
)

const handleSelect = (artifact: ArtifactType) => {
  // Re-check page-wide per-team uniqueness at pick time; the list filter can be
  // stale by the time the click lands. Close only on a successful placement.
  if (grids.isArtifactUsed(artifact.id, props.team)) return
  ctx.setArtifact(props.team, artifact.id)
  // Active follows interaction, matching drop routing.
  grids.setActive(ctx.id)
  emit('close')
}
</script>

<template>
  <SelectionPopup :position @close="emit('close')">
    <ArtifactSelectionPalette :artifacts="availableArtifacts" @pick="handleSelect" />
  </SelectionPopup>
</template>
