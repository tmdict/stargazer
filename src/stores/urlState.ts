import { defineStore } from 'pinia'

import { repositionCompanions } from '@/lib/characters/companion'
import { PHANTIMAL_ID_OFFSET, toPhantimalId } from '@/lib/characters/phantimal'
import { toSynergyId } from '@/lib/characters/synergy'
import { COMPANION_ID_OFFSET } from '@/lib/grid'
import { Team } from '@/lib/types/team'
import { unpackDisplayFlags, type DisplayFlags, type GridState } from '@/utils/gridStateSerializer'
import { decodeGridStateFromUrl, decodeMultiGridStateFromUrl } from '@/utils/urlStateManager'
import { useArtifactStore } from './artifact'
import { useCharacterStore } from './character'
import { useGridStore } from './grid'
import { MAX_GRID_COUNT, useGrids } from './grids'

interface UrlRestoreResult {
  success: boolean
  displayFlags?: DisplayFlags
  // Multi-board only: false when the payload carried no `d` field, so callers can
  // keep the viewer's current flags instead of applying unpack defaults (canonical
  // saved-team data deliberately has no `d`; see lib/teams).
  hasDisplayFlags?: boolean
  error?: string
}

export const useUrlStateStore = defineStore('urlState', () => {
  const gridStore = useGridStore()
  const characterStore = useCharacterStore()
  const artifactStore = useArtifactStore()
  const grids = useGrids()

  const restoreFromEncodedState = (encodedState: string | null): UrlRestoreResult => {
    if (!encodedState) {
      return { success: false, error: 'No state provided' }
    }

    try {
      const gridState = decodeGridStateFromUrl(encodedState)
      if (!gridState) {
        return { success: false, error: 'Invalid state data' }
      }

      applyGridState(gridState)
      grids.deriveSynergy()

      const displayFlags = unpackDisplayFlags(gridState.d)
      return { success: true, displayFlags }
    } catch (err) {
      console.error('Failed to restore state from encoded string:', err)
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  }

  const applyGridState = (gridState: GridState): void => {
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

    characterStore.clearAllCharacters()
    artifactStore.clearAllArtifacts()
    gridStore.resetAllTiles()

    // Restore tile states from compact format: [hexId, state]
    if (gridState.t) {
      gridState.t.forEach((entry) => {
        const validated = getValidatedTileEntry(entry)
        if (!validated) return

        try {
          const hex = gridStore.getHexById(validated.hexId)
          gridStore.setState(hex, validated.state)
        } catch (error) {
          console.warn(`Failed to restore tile state for hex ${validated.hexId}:`, error)
        }
      })
    }

    // Restore one character band ([hexId, localId, team] entries whose locals
    // share c's id space; `toUnitId` lifts a local into the band's namespace).
    // Companions are skill-spawned, not placed directly, so each main is placed
    // and its companions are settled onto their saved hexes right away: doing
    // this per main (rather than after every main is placed) stops a spawned
    // companion from squatting on a tile a later main needs, a collision that
    // would evict the squatter and, since it is a companion, drop its whole unit.
    const restoreCharacterBand = (
      entries: number[][],
      toUnitId: (localId: number) => number,
    ): void => {
      const mains: number[][] = []
      const companions: number[][] = []
      entries.forEach((entry) => {
        const localId = entry[1]
        if (localId === undefined) return
        // Only base and companion locals are legal here; a phantimal- or
        // synergy-band value would otherwise slip into companion matching below
        // (200050 % 10000 matches hero 50) and raw-place an orphan. The multi
        // codec has no validation pass, so crafted values are dropped here.
        if (localId >= PHANTIMAL_ID_OFFSET) return
        if (localId >= COMPANION_ID_OFFSET) companions.push(entry)
        else mains.push(entry)
      })

      const grid = grids.active!.grid
      mains.forEach((entry) => {
        const validated = getValidatedCharacterEntry(entry)
        if (!validated) return

        const unitId = toUnitId(validated.characterId)
        if (!characterStore.placeCharacterOnHex(validated.hexId, unitId, validated.team)) {
          console.warn(`Failed to place character ID ${unitId} on hex ${validated.hexId}`)
          return
        }
        const companionTargets = companions
          .filter(
            (e) => e[1]! % COMPANION_ID_OFFSET === validated.characterId && e[2] === validated.team,
          )
          .map((e) => ({ companionId: toUnitId(e[1]!), hexId: e[0]! }))
        repositionCompanions(grid, validated.team, companionTargets)
      })
    }

    if (gridState.c) restoreCharacterBand(gridState.c, (localId) => localId)
    // Position is load-bearing: after c so the synergy hero's faction is visible
    // to the phantimal placements below, and before seedPhantimalBaseline so the
    // bulk restore doesn't read as a qualifying transition.
    if (gridState.y) restoreCharacterBand(gridState.y, toSynergyId)

    // Restore upgrade attrs from compact format: [team, characterId, attrId,
    // value]. Characters are already placed; setAttr keys by team + character,
    // so it doesn't depend on hex placement, and an unknown attrId (crafted
    // payload) clamps to default and stores nothing.
    if (gridState.u) {
      const ctx = grids.active!
      gridState.u.forEach((entry) => {
        const [team, characterId, attrId, value] = entry
        if (
          team === undefined ||
          characterId === undefined ||
          attrId === undefined ||
          value === undefined
        ) {
          return
        }
        ctx.setAttr(team, characterId, attrId, value)
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
    if (gridState.s) {
      gridState.s.forEach((entry) => {
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

      // Boards beyond the supported maximum (a crafted URL) are dropped.
      const boards = multi.boards.slice(0, MAX_GRID_COUNT)
      grids.setGridCount(
        boards.length,
        boards.map((b) => b.m),
      )
      boards.forEach((boardState, i) => {
        grids.setActive(i)
        applyGridState(boardState)
      })
      grids.setActive(Math.min(Math.max(multi.active ?? 0, 0), boards.length - 1))
      // The per-board apply can only validate per grid, so a crafted URL could
      // restore the same hero twice on one team across boards; repair page-wide
      // uniqueness once every board is in.
      grids.dedupeCharacters()
      grids.deriveSynergy()

      return {
        success: true,
        displayFlags: unpackDisplayFlags(multi.d),
        hasDisplayFlags: multi.d !== undefined,
      }
    } catch (err) {
      console.error('Failed to restore multi state from encoded string:', err)
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  }

  return {
    restoreFromEncodedState,
    restoreMultiFromEncodedState,
  }
})
