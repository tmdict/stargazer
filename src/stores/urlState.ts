import { defineStore } from 'pinia'

import { Team } from '../lib/types/team'
import { useStateReset } from '../composables/useStateReset'
import { useToast } from '../composables/useToast'
import { unpackDisplayFlags } from '../utils/gridStateSerializer'
import { getGridStateFromCurrentUrl } from '../utils/urlStateManager'
import { useArtifactStore } from './artifact'
import { useCharacterStore } from './character'
import { useGridStore } from './grid'

export const useUrlStateStore = defineStore('urlState', () => {
  // Store instances created once at store level
  const gridStore = useGridStore()
  const characterStore = useCharacterStore()
  const artifactStore = useArtifactStore()
  const { clearAllState } = useStateReset()
  const { success, error } = useToast()

  // Restore grid state from URL parameters
  const restoreStateFromUrl = (): {
    showHexIds?: boolean
    showArrows?: boolean
    showPerspective?: boolean
    showSkills?: boolean
  } | null => {
    try {
      const urlState = getGridStateFromCurrentUrl()
      if (!urlState) {
        return null // No state in URL
      }

      // Clear existing state first using shared utility
      // This resets all tiles to DEFAULT, clears characters and artifacts
      clearAllState()

      // Restore tile states from compact format: [hexId, state]
      if (urlState.t) {
        urlState.t.forEach(([hexId, state]) => {
          try {
            const hex = gridStore.getHexById(hexId)
            gridStore.setState(hex, state)
          } catch (error) {
            console.warn(`Failed to restore tile state for hex ${hexId}:`, error)
          }
        })
      }

      // Restore character placements from compact format: [hexId, characterId, team]
      if (urlState.c) {
        // Separate main characters from companions
        const mainCharacters: typeof urlState.c = []
        const companions: typeof urlState.c = []

        urlState.c.forEach((entry) => {
          const [hexId, characterId, team] = entry
          if (characterId >= 10000) {
            companions.push(entry)
          } else {
            mainCharacters.push(entry)
          }
        })

        // Place main characters first (this will create companions via skills)
        mainCharacters.forEach(([hexId, characterId, team]) => {
          const placementSuccess = characterStore.placeCharacterOnHex(hexId, characterId, team)
          if (!placementSuccess) {
            console.warn(`Failed to place character ID ${characterId} on hex ${hexId}`)
            error("Some characters couldn't be placed")
          }
        })

        // For companions, we need to move them to their correct positions
        // The skill will have created them at random positions, but we need them at specific hexes
        companions.forEach(([targetHexId, companionId, team]) => {
          // Find where the companion was auto-placed
          const tiles = gridStore.getAllTiles
          const currentHex = tiles.find(
            (tile) => tile.characterId === companionId && tile.team === team,
          )

          if (currentHex) {
            const currentHexId = currentHex.hex.getId()
            // Move the companion to the correct position
            const moveSuccess = characterStore.moveCharacter(currentHexId, targetHexId, companionId)
            if (!moveSuccess) {
              console.warn(
                `Failed to move companion ID ${companionId} from hex ${currentHexId} to ${targetHexId}`,
              )
            }
          } else {
            console.warn(
              `Companion ID ${companionId} was not created by skill - this shouldn't happen`,
            )
          }
        })
      }

      // Restore artifacts from compact format: [ally, enemy]
      if (urlState.a) {
        const [allyArtifact, enemyArtifact] = urlState.a
        if (allyArtifact !== null) {
          artifactStore.placeArtifact(allyArtifact, Team.ALLY)
        }
        if (enemyArtifact !== null) {
          artifactStore.placeArtifact(enemyArtifact, Team.ENEMY)
        }
      }

      // Restore display flags if present
      const displayFlags = unpackDisplayFlags(urlState.d)

      // URL state restoration completed successfully
      success('Grid loaded from URL!')

      // Return the display flags to be applied by the caller
      return displayFlags
    } catch (err) {
      console.error('Failed to restore state from URL:', err)
      error('Invalid URL - using default grid')
      return null
    }
  }

  return {
    restoreStateFromUrl,
  }
})
