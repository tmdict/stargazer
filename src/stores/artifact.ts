/* Single-board artifact actions over the active grid context.
 *
 * Adapts the active board's artifact slots in useGrids to the artifact API the
 * Arena consumes. Artifacts are per board (each grid has its own ally/enemy pair).
 */

import { computed } from 'vue'
import { defineStore } from 'pinia'

import { Team } from '@/lib/types/team'
import { useGrids } from './grids'

export const useArtifactStore = defineStore('artifact', () => {
  const grids = useGrids()
  const active = () => grids.active!

  const allyArtifactId = computed(() => active().artifacts.ally)
  const enemyArtifactId = computed(() => active().artifacts.enemy)

  // Enforce page-wide per-team uniqueness at the store boundary so no write path can
  // duplicate an artifact on a team; the picker also hides used options for UX.
  const placeArtifact = (artifactId: number, team: Team): boolean => {
    if (grids.isArtifactUsed(artifactId, team)) return false
    active().setArtifact(team, artifactId)
    return true
  }

  const removeArtifact = (team: Team): void => active().removeArtifact(team)

  const clearAllArtifacts = (): void => active().clearArtifacts()

  return {
    allyArtifactId,
    enemyArtifactId,
    placeArtifact,
    removeArtifact,
    clearAllArtifacts,
  }
})
