import { defineStore } from 'pinia'

import { repositionCompanions } from '@/lib/characters/companion'
import { toPhantimalId } from '@/lib/characters/phantimal'
import { COMPANION_ID_OFFSET } from '@/lib/grid'
import { Team } from '@/lib/types/team'
import {
  mirrorGridState,
  serializeGridState,
  unpackDisplayFlags,
  type DisplayFlags,
  type GridState,
} from '@/utils/gridStateSerializer'
import { decodeGridStateFromUrl, decodeMultiGridStateFromUrl } from '@/utils/urlStateManager'
import { useArtifactStore } from './artifact'
import { useCharacterStore } from './character'
import { useGridStore } from './grid'
import { useGrids } from './grids'

interface UrlRestoreResult {
  success: boolean
  displayFlags?: DisplayFlags
  error?: string
}

export const useUrlStateStore = defineStore('urlState', () => {
  // Store instances created once at store level
  const gridStore = useGridStore()
  const characterStore = useCharacterStore()
  const artifactStore = useArtifactStore()
  const grids = useGrids()

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

    // Clear existing state first: characters, artifacts, and all tile states
    characterStore.clearAllCharacters()
    artifactStore.clearAllArtifacts()
    gridStore.resetAllTiles()

    // Restore tile states from compact format: [hexId, state]
    if (gridState.t) {
      gridState.t.forEach((entry) => {
        const validated = getValidatedTileEntry(entry)
        if (!validated) return // Skip if can't verify the entry

        try {
          const hex = gridStore.getHexById(validated.hexId)
          gridStore.setState(hex, validated.state)
        } catch (error) {
          console.warn(`Failed to restore tile state for hex ${validated.hexId}:`, error)
        }
      })
    }

    // Restore character placements from compact format: [hexId, characterId, team]
    if (gridState.c) {
      // Companions are skill-spawned, not placed directly; settle them after
      // their owner is on the board.
      const mainCharacters: typeof gridState.c = []
      const companions: typeof gridState.c = []

      gridState.c.forEach((entry) => {
        const characterId = entry[1]
        if (characterId === undefined) return

        if (characterId >= COMPANION_ID_OFFSET) {
          companions.push(entry)
        } else {
          mainCharacters.push(entry)
        }
      })

      // Place each main character, then immediately settle its companions onto
      // their saved hexes. Doing this per main (rather than after every main is
      // placed) stops a skill-spawned companion from squatting on a tile a later
      // main needs: that collision would evict the squatter, and since it is a
      // companion the eviction cascades to drop its whole unit.
      const grid = grids.active!.grid
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
          return
        }
        const companionTargets = companions
          .filter(
            (e) => e[1]! % COMPANION_ID_OFFSET === validated.characterId && e[2] === validated.team,
          )
          .map((e) => ({ companionId: e[1]!, hexId: e[0]! }))
        repositionCompanions(grid, validated.team, companionTargets)
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

    // Restore phantimals from compact format: [hexId, localPhantimalId, team]
    if (gridState.p) {
      gridState.p.forEach((entry) => {
        const hexId = entry[0]
        const localId = entry[1]
        const team = entry[2]
        if (hexId === undefined || localId === undefined || team === undefined) return

        const placed = characterStore.placePhantimalOnHex(hexId, toPhantimalId(localId), team)
        if (!placed) {
          console.warn(`Failed to place phantimal ${localId} on hex ${hexId}`)
        }
      })
    }

    // Auto-placement is edge-triggered; this bulk restore must not read as a
    // transition, or a saved state that omits its phantimal would gain one.
    characterStore.seedPhantimalBaseline()
  }

  // Restore N boards (5 v 5): rebuild the board array, then restore each board by
  // temporarily making it active so the same per-board apply path is reused.
  const restoreMultiFromEncodedState = (encodedState: string | null): UrlRestoreResult => {
    if (!encodedState) {
      return { success: false, error: 'No state provided' }
    }

    try {
      const multi = decodeMultiGridStateFromUrl(encodedState)
      if (!multi || multi.boards.length === 0) {
        return { success: false, error: 'Invalid state data' }
      }

      grids.setGridCount(multi.boards.length)
      multi.boards.forEach((boardState, i) => {
        grids.setActive(i)
        applyGridState(boardState)
      })
      grids.setActive(Math.min(Math.max(multi.active ?? 0, 0), multi.boards.length - 1))

      return { success: true, displayFlags: unpackDisplayFlags(multi.d) }
    } catch (err) {
      console.error('Failed to restore multi state from encoded string:', err)
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  }

  // Mirror every board's units onto the opposite team at their 180-degree-rotated
  // tiles (tile 1 <-> 45), so the formation rotates to the other side keeping its
  // shape. Each board is serialized, mirrored, and rebuilt through the same restore
  // path as a URL load, which already repositions companions and re-seeds the
  // phantimal baseline. Pairs with the global `inverted` presentation flip.
  const swapTeamsAllBoards = (): void => {
    const previousActive = grids.activeId
    grids.contexts.forEach((ctx, i) => {
      const state = serializeGridState(
        ctx.grid.getAllTiles(),
        ctx.artifacts.ally,
        ctx.artifacts.enemy,
        undefined,
        ctx.getBaseTileState,
      )
      if (!state.c && !state.p && !state.a) return // nothing to swap on this board
      const mirrored = mirrorGridState(state, (hexId) => ctx.grid.getRotatedHexId(hexId))
      grids.setActive(i)
      applyGridState(mirrored)
    })
    grids.setActive(previousActive)
  }

  return {
    restoreFromEncodedState,
    restoreMultiFromEncodedState,
    swapTeamsAllBoards,
  }
})
