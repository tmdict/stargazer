/* Pure mapping from a saved team's encoded data to thumbnail inputs: one entry
 * per board with its map key and occupied hexes. Image resolution stays in the
 * component layer (it needs the game-data store); this split keeps the mapping
 * unit-testable headless. */

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

export interface PreviewBoard {
  mapKey: string
  // The board's serialized tile states — authoritative for rendering (an empty
  // array means an all-default board; undefined means no t section was present).
  tiles?: number[][]
  units: PreviewUnit[]
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
    for (const entry of board.p ?? []) {
      const [hexId, phantimalId, team] = entry
      if (hexId === undefined || phantimalId === undefined || team === undefined) continue
      units.push({ hexId, team: team as Team, phantimalId })
    }
    return { mapKey: board.m ?? 'arena1', tiles: board.t, units }
  })
}
