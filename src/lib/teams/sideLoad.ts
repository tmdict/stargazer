/* One-side saved-team loading: eligibility (the "single team" rule) and the
 * placement plan the grids store executes.
 *
 * A record is loadable when every unit on every board (heroes, companions,
 * phantimals, synergy units) belongs to one team; the rule spans the whole
 * record, never a single board. Pure data mapping so both stay unit-testable
 * headless; grid concerns (invert mirroring, page-wide uniqueness, scope)
 * live in the store action that consumes the plan.
 *
 * Reads the unit-bearing sections (c/s/y) plus p and a directly, a sibling of
 * the BOARD_CONTENT_KEYS contract in gridStateSerializer.ts: a new
 * unit-bearing GridState section must be handled here (and in preview.ts)
 * too, or the one-side rule would silently miss its units.
 */

import { isCompanionUnitId } from '@/lib/characters/character'
import { PHANTIMAL_ID_OFFSET, toPhantimalId } from '@/lib/characters/phantimal'
import { toSynergyId } from '@/lib/characters/synergy'
import { COMPANION_ID_OFFSET } from '@/lib/grid'
import { Team } from '@/lib/types/team'
import type { MultiGridState } from '@/utils/gridStateSerializer'
import { decodeMultiGridStateFromUrl } from '@/utils/urlStateManager'

export interface SideLoadUnit {
  // Full unit id: base hero, placeholder, synergy-band hero, or phantimal-band id.
  unitId: number
  // The record's own hex; the executor resolves it against the live map.
  hexId: number
  // Saved paragon level; 0 must still be applied so a stale level lingering on
  // the board (paragon survives removal) can't attach to the incoming hero.
  paragon: number
}

export interface SideLoadCompanion {
  unitId: number
  hexId: number
  // The main (band-preserving) whose skill spawns this companion; the executor
  // settles the spawned companion onto `hexId` right after that main places.
  mainUnitId: number
}

export interface SideLoadBoard {
  mains: SideLoadUnit[]
  companions: SideLoadCompanion[]
  phantimal: SideLoadUnit | null
  artifact: number | null
}

export interface SideLoadPlan {
  side: Team
  boards: SideLoadBoard[]
}

/* The one team every unit in the decoded record belongs to, or null: mixed
 * sides, no units at all, or a corrupt team field all disqualify. */
function sideOfDecoded(decoded: MultiGridState): Team | null {
  let side: Team | null = null
  for (const board of decoded.boards) {
    for (const entry of [...(board.c ?? []), ...(board.s ?? []), ...(board.y ?? [])]) {
      const team = entry[2]
      if (team !== Team.ALLY && team !== Team.ENEMY) return null
      if (side === null) side = team
      else if (side !== team) return null
    }
  }
  return side
}

// Memoized on the immutable data string (records mutate by replacement, so
// entries never go stale). Unbounded by design: entries are tiny and the
// library caps at 200 records.
const sideCache = new Map<string, Team | null>()

export function savedTeamSide(data: string): Team | null {
  const cached = sideCache.get(data)
  if (cached !== undefined) return cached
  const decoded = decodeMultiGridStateFromUrl(data)
  const side = decoded ? sideOfDecoded(decoded) : null
  sideCache.set(data, side)
  return side
}

/* Null when the record isn't a one-side team. Companions (both bands) spawn
 * from their main's skill rather than placing directly, so they're carried as
 * settle targets, not mains. The synergy hero rides in `mains` under its band
 * id (place/autoPlace resolve it like any unit), included with its companions
 * only when the destination mode offers the Syn affordance. */
export function buildSideLoadPlan(data: string, allowSynergy: boolean): SideLoadPlan | null {
  const decoded = decodeMultiGridStateFromUrl(data)
  if (!decoded) return null
  const side = sideOfDecoded(decoded)
  if (side === null) return null

  const boards = decoded.boards.map((board): SideLoadBoard => {
    const paragonByHero = new Map<number, number>()
    for (const [team, characterId, level] of board.p ?? []) {
      if (team === side && characterId !== undefined && level !== undefined) {
        paragonByHero.set(characterId, level)
      }
    }

    const mains: SideLoadUnit[] = []
    const companions: SideLoadCompanion[] = []
    for (const [hexId, characterId] of board.c ?? []) {
      if (hexId === undefined || characterId === undefined) continue
      // Only base and companion values are legal in c; a crafted phantimal- or
      // synergy-band value would bypass placePhantimal's cap/faction gates and
      // the mode's synergy strip (the codec has no validation pass).
      if (characterId >= PHANTIMAL_ID_OFFSET) continue
      if (isCompanionUnitId(characterId)) {
        companions.push({
          unitId: characterId,
          hexId,
          mainUnitId: characterId % COMPANION_ID_OFFSET,
        })
      } else {
        mains.push({ unitId: characterId, hexId, paragon: paragonByHero.get(characterId) ?? 0 })
      }
    }
    if (allowSynergy) {
      for (const [hexId, localId] of board.y ?? []) {
        if (hexId === undefined || localId === undefined) continue
        if (localId >= PHANTIMAL_ID_OFFSET) continue
        if (localId >= COMPANION_ID_OFFSET) {
          companions.push({
            unitId: toSynergyId(localId),
            hexId,
            mainUnitId: toSynergyId(localId % COMPANION_ID_OFFSET),
          })
        } else {
          mains.push({ unitId: toSynergyId(localId), hexId, paragon: 0 })
        }
      }
    }

    // One phantimal per team per board, so the first entry is the board's.
    const phantimalEntry = (board.s ?? []).find(
      ([hexId, localId]) => hexId !== undefined && localId !== undefined,
    )
    const phantimal: SideLoadUnit | null = phantimalEntry
      ? { unitId: toPhantimalId(phantimalEntry[1]!), hexId: phantimalEntry[0]!, paragon: 0 }
      : null

    const artifact = (side === Team.ALLY ? board.a?.[0] : board.a?.[1]) ?? null
    return { mains, companions, phantimal, artifact }
  })

  return { side, boards }
}
