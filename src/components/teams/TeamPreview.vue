<script lang="ts">
import { TEAM_MODES, type TeamModeKey } from '@/lib/teams/modes'

/* MountOnVisible placeholder height for a team's thumbnail. Boards wrap three
   per row (CSS below); the row constant sits between the rendered row heights
   at phone and desktop widths — an offscreen placeholder needs no better. */
const BOARD_ROW_PX = 130
const PREVIEW_PADDING_PX = 16
export function estimatedPreviewHeight(mode: TeamModeKey): number {
  return Math.ceil(TEAM_MODES[mode].boardCount / 3) * BOARD_ROW_PX + PREVIEW_PADDING_PX
}
</script>

<script setup lang="ts">
/* A saved team's thumbnail: one mini board per grid, rendered from the record's
   canonical data (never from live contexts or DOM capture). Hero portraits are
   clipped into their hexes; unresolvable units fall back to team-colored dots;
   an undecodable record renders a warning tile instead of breaking the list. */

import { computed } from 'vue'

import BoardThumbnail, { type ThumbnailUnit } from '@/components/grid/BoardThumbnail.vue'
import { isStandardHero, teamPreviewBoards, type PreviewUnit } from '@/lib/teams/preview'
import type { SavedTeam } from '@/lib/teams/savedTeam'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import { isRemoteArtifact, phantimalImageUrl, seasonArtifactImageUrl } from '@/utils/artifactImage'

const {
  team,
  large = false,
  highlightHeroes,
} = defineProps<{
  team: SavedTeam
  // Modal scale: bigger boards, hex size raised in proportion so strokes stay
  // hairline.
  large?: boolean
  // Hero slugs to ring. Companions and phantimals never match.
  highlightHeroes?: ReadonlySet<string>
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

// The same local/remote split ArtifactImage makes for the live board.
const resolveArtifactImage = (artifactId: number | null): string | undefined => {
  if (artifactId === null) return undefined
  const artifact = gameData.getArtifactById(artifactId)
  if (!artifact) return undefined
  return isRemoteArtifact(artifact.season)
    ? seasonArtifactImageUrl(artifact.name)
    : gameData.getArtifactImage(artifact.name) || undefined
}

const isHighlighted = (unit: PreviewUnit): boolean => {
  if (!highlightHeroes || !isStandardHero(unit)) return false
  const slug = gameData.getCharacterNameById(unit.characterId)
  return slug !== undefined && highlightHeroes.has(slug)
}

// Decoded once per record; team.data is immutable (updates replace the record).
const decoded = computed(() => teamPreviewBoards(team.data))

// Split from the decode so a changing highlight (typing in the team search)
// reuses it.
const boards = computed(() => {
  if (!decoded.value) return null
  return decoded.value.map((board) => ({
    mapKey: board.mapKey,
    tiles: board.tiles,
    artifacts: {
      ally: resolveArtifactImage(board.artifacts.ally),
      enemy: resolveArtifactImage(board.artifacts.enemy),
    },
    units: board.units.map((unit): ThumbnailUnit => ({
      hexId: unit.hexId,
      team: unit.team,
      image: resolveImage(unit),
      highlight: isHighlighted(unit),
    })),
  }))
})
</script>

<template>
  <div class="team-preview" :class="{ large }">
    <template v-if="boards">
      <BoardThumbnail
        v-for="(board, index) in boards"
        :key="index"
        class="board-thumb"
        :map-key="board.mapKey"
        :tiles="board.tiles"
        :units="board.units"
        :artifacts="board.artifacts"
        :hex-size="large ? 18 : 10"
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

/* Fixed basis, not a percentage: boards render full-size at any board count,
   wrapping to fit. Unplated, like the rest of the modal's content. */
.team-preview.large {
  gap: 10px;
  padding: 0;
  background: none;
}

.team-preview.large .board-thumb {
  flex: 0 1 290px;
  max-width: 340px;
}

.preview-broken {
  font-size: 1.4rem;
  color: var(--color-text-secondary);
}
</style>
