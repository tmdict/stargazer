import { defineStore } from 'pinia'

import { useStateReset } from '../composables/useStateReset'
import { Team } from '../lib/types/team'
import { unpackDisplayFlags, type GridState } from '../utils/gridStateSerializer'
import { decodeGridStateFromUrl } from '../utils/urlStateManager'
import { useArtifactStore } from './artifact'
import { useCharacterStore } from './character'
import { useGridStore } from './grid'

interface UrlRestoreResult {
  success: boolean
  displayFlags?: {
    showHexIds?: boolean
    showArrows?: boolean
    showPerspective?: boolean
    showSkills?: boolean
  }
  error?: string
}

export const useUrlStateStore = defineStore('urlState', () => {
  // Store instances created once at store level
  const gridStore = useGridStore()
  const characterStore = useCharacterStore()
  const artifactStore = useArtifactStore()
  const { clearAllState } = useStateReset()

  // Restore grid state from encoded string
  const restoreFromEncodedState = (encodedState: string | null): UrlRestoreResult => {
    if (!encodedState) {
      return { success: false, error: 'No state provided' }
    }

    try {
      const gridState = decodeGridStateFromUrl(encodedState)
      if (!gridState) {
        return { success: false, error: 'Invalid state data' }
      }

      // Apply the decoded state
      applyGridState(gridState)

      // Return success with display flags
      const displayFlags = unpackDisplayFlags(gridState.d)
      return { success: true, displayFlags }
    } catch (err) {
      console.error('Failed to restore state from encoded string:', err)
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  }

  // Apply grid state to stores (private helper)
  const applyGridState = (gridState: GridState): void => {
    // Helper functions to safely extract validated entries
    const getValidatedTileEntry = (entry: number[]): { hexId: number; state: number } | null => {
      const hexId = entry[0]
      const state = entry[1]

      if (hexId === undefined || state === undefined) return null
      return { hexId, state }
    }

    const getValidatedCharacterEntry = (
      entry: number[],
    ): { hexId: number; characterId: number; team: number } | null => {
      const hexId = entry[0]
      const characterId = entry[1]
      const team = entry[2]

      if (hexId === undefined || characterId === undefined || team === undefined) return null
      return { hexId, characterId, team }
    }

    // Clear existing state first using shared utility
    // This resets all tiles to DEFAULT, clears characters and artifacts
    clearAllState()

    // Restore tile states from compact format: [hexId, state]
    if (gridState.t) {
      gridState.t.forEach((entry) => {
        const validated = getValidatedTileEntry(entry)
        if (!validated) return // Skip if can't verify the entry

        try {
          const hex = gridStore.getHexById(validated.hexId)
          if (!gridStore.setState(hex, validated.state)) {
            console.warn(`Failed to set state ${validated.state} for hex ${validated.hexId}`)
          }
        } catch (error) {
          console.warn(`Failed to restore tile state for hex ${validated.hexId}:`, error)
        }
      })
    }

    // Restore character placements from compact format: [hexId, characterId, team]
    if (gridState.c) {
      // Separate main characters from companions
      const mainCharacters: typeof gridState.c = []
      const companions: typeof gridState.c = []

      gridState.c.forEach((entry) => {
        const characterId = entry[1]
        if (characterId === undefined) return

        if (characterId >= 10000) {
          companions.push(entry)
        } else {
          mainCharacters.push(entry)
        }
      })

      // Place main characters first (this will create companions via skills)
      mainCharacters.forEach((entry) => {
        const validated = getValidatedCharacterEntry(entry)
        if (!validated) return

        const placementSuccess = characterStore.placeCharacterOnHex(
          validated.hexId,
          validated.characterId,
          validated.team,
        )
        if (!placementSuccess) {
          console.warn(
            `Failed to place character ID ${validated.characterId} on hex ${validated.hexId}`,
          )
        }
      })

      // For companions, we need to move them to their correct positions
      // The skill will have created them at random positions, but we need them at specific hexes
      companions.forEach((entry) => {
        const validated = getValidatedCharacterEntry(entry)
        if (!validated) return

        // Find where the companion was auto-placed
        const tiles = gridStore.getAllTiles
        const currentHex = tiles.find(
          (tile) => tile.characterId === validated.characterId && tile.team === validated.team,
        )

        if (currentHex) {
          const currentHexId = currentHex.hex.getId()
          // Move the companion to the correct position
          const moveSuccess = characterStore.moveCharacter(
            currentHexId,
            validated.hexId,
            validated.characterId,
          )
          if (!moveSuccess) {
            console.warn(
              `Failed to move companion ID ${validated.characterId} from hex ${currentHexId} to ${validated.hexId}`,
            )
          }
        } else {
          console.warn(
            `Companion ID ${validated.characterId} was not created by skill - this shouldn't happen`,
          )
        }
      })
    }

    // Restore artifacts from compact format: [ally, enemy]
    if (gridState.a) {
      const allyArtifact = gridState.a[0] ?? null // null: no ally artifact
      const enemyArtifact = gridState.a[1] ?? null // null: no enemy artifact
      if (allyArtifact !== null) {
        artifactStore.placeArtifact(allyArtifact, Team.ALLY)
      }
      if (enemyArtifact !== null) {
        artifactStore.placeArtifact(enemyArtifact, Team.ENEMY)
      }
    }
  }

  return {
    restoreFromEncodedState,
  }
})
