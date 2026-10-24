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

import BoardThumbnail, { type ThumbnailArtifact } from '@/components/grid/BoardThumbnail.vue'
import { usePreviewImages } from '@/composables/usePreviewImages'
import {
  isStandardHero,
  lineupArtifactKey,
  lineupHeroKey,
  teamPreviewBoards,
  type PreviewArtifact,
  type PreviewUnit,
} from '@/lib/teams/preview'
import type { SavedTeam } from '@/lib/teams/savedTeam'
import { Team } from '@/lib/types/team'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'

const {
  team,
  large = false,
  highlights,
} = defineProps<{
  team: SavedTeam
  // Modal scale: bigger boards, hex size raised in proportion so strokes stay
  // hairline.
  large?: boolean
  // lineupHeroKey and lineupArtifactKey keys of what to ring; the rest of the
  // card fades. Companions and phantimals never match.
  highlights?: ReadonlySet<string>
}>()

const gameData = useGameDataStore()
const i18n = useI18nStore()
const { thumbnailUnit, thumbnailArtifact } = usePreviewImages()

const resolveArtifact = (
  slot: PreviewArtifact,
  board: number,
  team: Team,
): ThumbnailArtifact | undefined => {
  const artifact = thumbnailArtifact(slot)
  if (!artifact || typeof slot !== 'number') return artifact
  return { ...artifact, highlight: highlights?.has(lineupArtifactKey(board, team)) ?? false }
}

const isHighlighted = (board: number, unit: PreviewUnit): boolean => {
  if (!highlights || !isStandardHero(unit)) return false
  const slug = gameData.getCharacterNameById(unit.characterId)
  return slug !== undefined && highlights.has(lineupHeroKey(board, unit.team, slug))
}

// Decoded once per record; team.data is immutable (updates replace the record).
const decoded = computed(() => teamPreviewBoards(team.data))

// Split from the decode so a changing highlight (typing in the team search)
// reuses it.
const boards = computed(() => {
  if (!decoded.value) return null
  return decoded.value.map((board, index) => {
    const units = board.units.map((unit) =>
      unit.retiredSeason !== undefined
        ? thumbnailUnit(unit)
        : { ...thumbnailUnit(unit), highlight: isHighlighted(index, unit) },
    )
    const artifacts = {
      ally: resolveArtifact(board.artifacts.ally, index, Team.ALLY),
      enemy: resolveArtifact(board.artifacts.enemy, index, Team.ENEMY),
    }
    return {
      mapKey: board.mapKey,
      tiles: board.tiles,
      artifacts,
      units,
      matched:
        units.some((unit) => unit.highlight) ||
        !!artifacts.ally?.highlight ||
        !!artifacts.enemy?.highlight,
    }
  })
})

// While any board rings a hero or artifact, the boards without one fade whole,
// pointing a multi-board record at the board that matched.
const spotlit = computed(() => boards.value?.some((board) => board.matched) ?? false)
</script>

<template>
  <div class="team-preview" :class="{ large }">
    <template v-if="boards">
      <BoardThumbnail
        v-for="(board, index) in boards"
        :key="index"
        class="board-thumb"
        :class="{ dimmed: spotlit && !board.matched }"
        :map-key="board.mapKey"
        :tiles="board.tiles"
        :units="board.units"
        :artifacts="board.artifacts"
        :hex-size="large ? 18 : 10"
        :crisp="large"
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

.board-thumb {
  flex: 0 1 30%;
  min-width: 0;
  max-width: 165px;
  height: auto;
}

.board-thumb.dimmed {
  opacity: 0.35;
}

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
