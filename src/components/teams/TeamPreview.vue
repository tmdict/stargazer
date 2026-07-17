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
import { useI18nStore } from '@/stores/i18n'
import { phantimalImageUrl } from '@/utils/artifactImage'

const { team } = defineProps<{
  team: SavedTeam
}>()

const gameData = useGameDataStore()
const i18n = useI18nStore()

const resolveImage = (unit: PreviewUnit): string | undefined => {
  if (unit.characterId !== undefined) {
    // Companion-aware: the store maps companion ids to the main hero's
    // portrait or the skill's custom companion image.
    const name = gameData.getCharacterImageNameById(unit.characterId)
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
        :hex-size="10"
      />
    </template>
    <span v-else class="preview-broken" :title="i18n.t('app.team-unreadable')">⚠</span>
  </div>
</template>

<style scoped>
.team-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
  align-items: center;
  background: rgba(0, 0, 0, 0.05);
  border-radius: var(--radius-medium);
  padding: 8px 6px;
  min-height: 120px;
}

/* Boards wrap at three per row (5v5 renders 3+2); with the card grid's column
   minimum, each board renders large enough that the hero portraits inside its
   hexes read at a glance. */
.board-thumb {
  flex: 0 1 30%;
  min-width: 0;
  max-width: 165px;
  height: auto;
}

.preview-broken {
  font-size: 1.4rem;
  color: var(--color-text-secondary);
}
</style>
