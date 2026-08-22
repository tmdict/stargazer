/* Pure mapping from a saved team's encoded data to thumbnail inputs: one entry
 * per board with its map key, occupied hexes, and artifact ids. Image resolution
 * stays in the component layer (it needs the game-data store); this split keeps
 * the mapping unit-testable headless. */

import { COMPANION_ID_OFFSET } from '@/lib/grid'
import type { Team } from '@/lib/types/team'
import { decodeMultiGridStateFromUrl } from '@/utils/urlStateManager'

export interface PreviewUnit {
  hexId: number
  team: Team
  // Exactly one of the two is set (characters and phantimals resolve their
  // portraits through different dictionaries).
  characterId?: number
  phantimalId?: number
}

/* A main-roster hero: not a phantimal, not a companion summon. */
export function isStandardHero(unit: PreviewUnit): unit is PreviewUnit & { characterId: number } {
  return unit.characterId !== undefined && unit.characterId < COMPANION_ID_OFFSET
}

export interface PreviewBoard {
  mapKey: string
  // The board's serialized tile states, authoritative for rendering (an empty
  // array means an all-default board; undefined means no t section was present).
  tiles?: number[][]
  units: PreviewUnit[]
  artifacts: { ally: number | null; enemy: number | null }
}

/* Null = undecodable record (the card renders its fallback tile). */
export function teamPreviewBoards(data: string): PreviewBoard[] | null {
  const decoded = decodeMultiGridStateFromUrl(data)
  if (!decoded || decoded.boards.length === 0) return null

  return decoded.boards.map((board) => {
    const units: PreviewUnit[] = []
    for (const entry of board.c ?? []) {
      const [hexId, characterId, team] = entry
      if (hexId === undefined || characterId === undefined || team === undefined) continue
      units.push({ hexId, team: team as Team, characterId })
    }
    for (const entry of board.s ?? []) {
      const [hexId, phantimalId, team] = entry
      if (hexId === undefined || phantimalId === undefined || team === undefined) continue
      units.push({ hexId, team: team as Team, phantimalId })
    }
    // Synergy-band locals reuse c's id space, so portraits, companion art, and
    // the search index handle them with the same logic as c entries.
    for (const entry of board.y ?? []) {
      const [hexId, localId, team] = entry
      if (hexId === undefined || localId === undefined || team === undefined) continue
      units.push({ hexId, team: team as Team, characterId: localId })
    }
    return {
      mapKey: board.m ?? 'arena1',
      tiles: board.t,
      units,
      artifacts: { ally: board.a?.[0] ?? null, enemy: board.a?.[1] ?? null },
    }
  })
}
