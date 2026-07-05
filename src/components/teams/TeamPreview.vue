<script setup lang="ts">
/* A saved team's thumbnail: one mini board per grid, rendered from the record's
   canonical data (never from live contexts or DOM capture). Hero portraits are
   clipped into their hexes; unresolvable units fall back to team-colored dots;
   an undecodable record renders a warning tile instead of breaking the list. */

import { computed } from 'vue'

import BoardThumbnail, { type ThumbnailUnit } from '@/components/grid/BoardThumbnail.vue'
import { teamPreviewBoards, type PreviewUnit } from '@/lib/teams/preview'
import type { SavedTeam } from '@/lib/teams/savedTeam'
import { useGameDataStore } from '@/stores/gameData'
import { phantimalImageUrl } from '@/utils/artifactImage'

const { team } = defineProps<{
  team: SavedTeam
}>()

const gameData = useGameDataStore()

const resolveImage = (unit: PreviewUnit): string | undefined => {
  if (unit.characterId !== undefined) {
    const name = gameData.getCharacterById(unit.characterId)?.name
    const image = name ? gameData.getCharacterImage(name) : ''
    return image || undefined
  }
  if (unit.phantimalId !== undefined) {
    const name = gameData.getPhantimalById(unit.phantimalId)?.name
    return name ? phantimalImageUrl(name) : undefined
  }
  return undefined
}

// Decoded once per record; team.data is immutable (updates replace the record).
const boards = computed(() => {
  const decoded = teamPreviewBoards(team.data)
  if (!decoded) return null
  return decoded.map((board) => ({
    mapKey: board.mapKey,
    tiles: board.tiles,
    units: board.units.map(
      (unit): ThumbnailUnit => ({
        hexId: unit.hexId,
        team: unit.team,
        image: resolveImage(unit),
      }),
    ),
  }))
})
</script>

<template>
  <div class="team-preview">
    <template v-if="boards">
      <BoardThumbnail
        v-for="(board, index) in boards"
        :key="index"
        class="board-thumb"
        :map-key="board.mapKey"
        :tiles="board.tiles"
        :units="board.units"
        :hex-size="7"
      />
    </template>
    <span v-else class="preview-broken" title="Unreadable team data">⚠</span>
  </div>
</template>

<style scoped>
.team-preview {
  display: flex;
  gap: 4px;
  justify-content: center;
  align-items: center;
  background: rgba(0, 0, 0, 0.05);
  border-radius: var(--radius-medium);
  padding: 6px 4px;
  min-height: 72px;
}

/* Boards split the row evenly; the SVG scales through its viewBox. */
.board-thumb {
  flex: 1 1 0;
  min-width: 0;
  max-width: 96px;
  height: auto;
}

.preview-broken {
  font-size: 1.4rem;
  color: var(--color-text-secondary);
}
</style>
