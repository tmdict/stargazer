import { defineStore } from 'pinia'
import { ref, readonly } from 'vue'

import { Team } from '../lib/types/team'

export const useArtifactStore = defineStore('artifact', () => {
  // Artifact tracking using numeric IDs
  const allyArtifactId = ref<number | null>(null)
  const enemyArtifactId = ref<number | null>(null)

  // Actions
  const placeArtifact = (artifactId: number, team: Team): boolean => {
    if (team === Team.ALLY) {
      allyArtifactId.value = artifactId
    } else {
      enemyArtifactId.value = artifactId
    }
    return true
  }

  const removeArtifact = (team: Team) => {
    if (team === Team.ALLY) {
      allyArtifactId.value = null
    } else {
      enemyArtifactId.value = null
    }
  }

  const clearAllArtifacts = () => {
    allyArtifactId.value = null
    enemyArtifactId.value = null
  }

  const getArtifactId = (team: Team): number | null => {
    return team === Team.ALLY ? allyArtifactId.value : enemyArtifactId.value
  }

  return {
    // State (readonly)
    allyArtifactId: readonly(allyArtifactId),
    enemyArtifactId: readonly(enemyArtifactId),

    // Actions
    placeArtifact,
    removeArtifact,
    clearAllArtifacts,
    getArtifactId,
  }
})
