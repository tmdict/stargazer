<script setup lang="ts">
import { computed } from 'vue'

import ArtifactIcon from './ArtifactIcon.vue'
import { useSelectionState } from '@/composables/useSelectionState'
import type { ArtifactType } from '@/lib/types/artifact'
import { Team } from '@/lib/types/team'
import { artifactSlot, useGrids } from '@/stores/grids'
import { useI18nStore } from '@/stores/i18n'
import { localizedDisplayName } from '@/utils/nameFormatting'

const props = defineProps<{
  artifacts: readonly ArtifactType[]
}>()

const { fillOrder, targetArtifactTeam, targetArtifactGridId, clearArtifactTarget, artifactStore } =
  useSelectionState()
const grids = useGrids()
const i18n = useI18nStore()

const slotArtifactId = (team: Team): number | null =>
  team === Team.ALLY ? artifactStore.allyArtifactId : artifactStore.enemyArtifactId

// The team whose slot holds this artifact on any board (page-wide per-team
// uniqueness), or null.
const placedTeam = (artifactId: number): Team | null => {
  if (grids.findArtifactPlacement(artifactId, Team.ALLY)) return Team.ALLY
  if (grids.findArtifactPlacement(artifactId, Team.ENEMY)) return Team.ENEMY
  return null
}

// A targeted slot asks only about its own side: the other side may field the
// same artifact.
const isDimmed = (artifactId: number): boolean => {
  if (!grids.allowsArtifact(artifactId)) return true
  const team = targetArtifactTeam.value
  return team === null ? placedTeam(artifactId) !== null : grids.isArtifactUsed(artifactId, team)
}

const handleArtifactClick = (artifact: ArtifactType) => {
  if (!grids.allowsArtifact(artifact.id)) return
  // Tapping an on-grid artifact cell targets that cell's team on its board
  // (mobile); the pick toggles that slot directly.
  const targeted = targetArtifactTeam.value
  const targetCtx =
    targetArtifactGridId.value !== null ? grids.getContext(targetArtifactGridId.value) : undefined
  if (targeted !== null && targetCtx) {
    if (artifactSlot(targetCtx.artifacts, targeted) === artifact.id)
      targetCtx.removeArtifact(targeted)
    else grids.placeArtifact(targetCtx, artifact.id, targeted)
    clearArtifactTarget()
    return
  }
  // Already placed (on any board): clicking removes it from wherever it sits.
  const placed = placedTeam(artifact.id)
  if (placed !== null) {
    grids.removeArtifactFromAnyBoard(artifact.id, placed)
    return
  }
  const target = fillOrder.find((team) => slotArtifactId(team) === null)
  if (target !== undefined) artifactStore.placeArtifact(artifact.id, target)
}

// Group artifacts into their own section per season, newest season first, so
// current seasonal content leads and the evergreen pre-season set closes.
const seasonGroups = computed(() => {
  const bySeason = new Map<number, ArtifactType[]>()
  for (const artifact of props.artifacts) {
    const list = bySeason.get(artifact.season) ?? []
    list.push(artifact)
    bySeason.set(artifact.season, list)
  }
  return [...bySeason.entries()]
    .sort(([a], [b]) => b - a)
    .map(([season, artifacts]) => ({
      season,
      artifacts: [...artifacts].sort((a, b) => a.id - b.id),
    }))
})

// Season 0 is the evergreen pre-season set.
const seasonLabel = (season: number): string =>
  season === 0
    ? i18n.t('game.artifact')
    : `${i18n.t('game.season')} ${season} ${i18n.t('game.artifact')}`
</script>

<template>
  <div class="icon-groups">
    <section v-for="group in seasonGroups" :key="group.season" class="icon-group">
      <h3 class="seasonal-title">{{ seasonLabel(group.season) }}</h3>
      <div class="seasonal-cells">
        <!-- Named: artifacts rotate each season, so their icons are hard to learn. -->
        <div v-for="artifact in group.artifacts" :key="artifact.id" class="seasonal-cell">
          <ArtifactIcon
            :artifact
            :dimmed="isDimmed(artifact.id)"
            inspectable
            @artifact-click="handleArtifactClick"
          />
          <span class="seasonal-cell-name">
            {{ localizedDisplayName(i18n.t, 'artifact', artifact.name) }}
          </span>
        </div>
      </div>
    </section>
  </div>
</template>
