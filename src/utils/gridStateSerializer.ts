import {
  attrRowsFor,
  compareAttrRows,
  type AttrRecord,
  type AttrRow,
} from '@/lib/characters/attributes'
import { isBaseHeroId } from '@/lib/characters/character'
import { isPhantimalId, toLocalPhantimalId } from '@/lib/characters/phantimal'
import { decomposeUnitId, inSynergyBand } from '@/lib/characters/synergy'
import type { GridTile } from '@/lib/grid'
import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'

/* Ultra-compact format for URL serialization - the ONLY format we support */
export interface GridState {
  t?: number[][] // tiles: [hexId, state] (only non-default states)
  c?: number[][] // characters: [hexId, characterId, team]
  a?: (number | null)[] // artifacts: [ally, enemy] (only if at least one set)
  s?: number[][] // seasonal units, phantimals today: [hexId, localUnitId, team] (kept out of c, ids 100000+ don't fit the character field)
  y?: number[][] // synergy-band units, hero plus its companions: [hexId, localUnitId, team] (locals reuse c's id space: hero = base id, companion = N*10000+base)
  u?: number[][] // hero upgrade attrs (lib/characters/attributes): [team, characterId, attrId, value], sorted, non-default only
  d?: number // display flags: bit-packed (wrap, showSkills, showPerspective, inverted, teamView)
}

/* The user-facing display toggles carried in the URL's bit-packed `d` field */
export interface DisplayFlags {
  showPerspective?: boolean
  showSkills?: boolean
  teamView?: boolean
  inverted?: boolean
  // 5 v 5 only: the 3-2 "wrap" boards layout (vs one row). The Arena never sets it.
  wrap?: boolean
}

export function serializeGridState(
  allTiles: GridTile[],
  allyArtifact: number | null,
  enemyArtifact: number | null,
  displayFlags?: DisplayFlags,
  getAttrs?: (team: Team, characterId: number) => AttrRecord,
): GridState {
  const state: GridState = {}

  // Compact format [hexId, state], keeping only non-default tiles. Skills never
  // mutate tile state, so the live state is already the bare map.
  const nonDefaultTiles = allTiles
    .map((tile) => [tile.hex.getId(), tile.state])
    .filter((tile) => tile[1] !== State.DEFAULT)

  if (nonDefaultTiles.length > 0) {
    state.t = nonDefaultTiles
  }

  // Phantimals and synergy-band units are serialized separately so the character
  // section keeps its compact 16-bit id field.
  const characters = allTiles
    .filter(
      (tile) =>
        tile.characterId &&
        tile.team !== undefined &&
        !isPhantimalId(tile.characterId) &&
        !inSynergyBand(tile.characterId),
    )
    .map((tile) => [tile.hex.getId(), tile.characterId!, tile.team!])

  if (characters.length > 0) {
    state.c = characters
  }

  // Synergy-band units, stored by their local id (offset stripped). The local
  // space mirrors c's, so restore can reuse the same main/companion split.
  const synergyUnits = allTiles
    .filter(
      (tile) =>
        tile.characterId !== undefined &&
        tile.team !== undefined &&
        inSynergyBand(tile.characterId),
    )
    .map((tile) => [tile.hex.getId(), decomposeUnitId(tile.characterId!).localId, tile.team!])

  if (synergyUnits.length > 0) {
    state.y = synergyUnits
  }

  // Extract phantimals, stored by their local id (offset stripped).
  const phantimals = allTiles
    .filter(
      (tile) =>
        tile.characterId !== undefined &&
        tile.team !== undefined &&
        isPhantimalId(tile.characterId),
    )
    .map((tile) => [tile.hex.getId(), toLocalPhantimalId(tile.characterId!), tile.team!])

  if (phantimals.length > 0) {
    state.s = phantimals
  }

  // Upgrade attrs keyed by team + character; only base heroes carry them and
  // only non-default values are emitted, sorted so equal content is byte-equal.
  if (getAttrs) {
    const rows: AttrRow[] = []
    for (const tile of allTiles) {
      if (tile.characterId === undefined || tile.team === undefined) continue
      if (!isBaseHeroId(tile.characterId)) continue
      rows.push(...attrRowsFor(tile.team, tile.characterId, getAttrs(tile.team, tile.characterId)))
    }
    if (rows.length > 0) {
      state.u = rows.sort(compareAttrRows)
    }
  }

  // Convert artifacts to compact format: [ally, enemy]
  // Only include if at least one artifact is set
  if (allyArtifact !== null || enemyArtifact !== null) {
    state.a = [allyArtifact, enemyArtifact]
  }

  // Always include display flags even if 0 (all false)
  if (displayFlags) {
    state.d = packDisplayFlags(displayFlags)
  }

  return state
}

/* Pack the display toggles into one number, in the Teams control-row order.
 * Bit 0: wrap, 1: showSkills, 2: showPerspective (!Flat), 3: inverted,
 * 4: teamView */
export function packDisplayFlags(flags: DisplayFlags): number {
  let packed = 0
  if (flags.wrap) packed |= 1 << 0
  if (flags.showSkills) packed |= 1 << 1
  if (flags.showPerspective) packed |= 1 << 2
  if (flags.inverted) packed |= 1 << 3
  if (flags.teamView) packed |= 1 << 4
  return packed
}

/* One board's GridState plus its map key, so a restore can rebuild the board on
 * the map it was configured with. Note `t` is not edits-only: it carries every
 * non-default tile including the map's baseline available hexes, because restore
 * resets all tiles to DEFAULT and replays `t`; `m` mainly keeps currentMap honest
 * for UI highlight and re-serialization. */
export type BoardState = GridState & { m?: string }

/* Every board-level key that carries team content, in the serializer's emission
 * order. Canonical saved-team data (lib/teams/savedTeam) rebuilds boards from
 * exactly this list, so a new GridState section must be registered here too or
 * saved teams would silently drop it; the serializer contract test pins the
 * two together. The unit-bearing sections are also read directly by
 * lib/teams/preview.ts (thumbnails) and lib/teams/sideLoad.ts (the one-side
 * rule), so a new unit section must be handled there as well. `d` is
 * deliberately absent: it is viewer state, not content. */
export const BOARD_CONTENT_KEYS = ['t', 'c', 's', 'y', 'u', 'a', 'm'] as const

/* Multi-board state (Teams page): one BoardState per board, the active board,
 * the global display flags, and the team mode the boards belong to. `mode` is
 * always written by the serializer but optional on decode (links predating it
 * infer their mode from the board count; see lib/teams/modes.ts). */
export interface MultiGridState {
  boards: BoardState[]
  active?: number
  d?: number
  mode?: string
}

export interface BoardInput {
  tiles: GridTile[]
  allyArtifact: number | null
  enemyArtifact: number | null
  map: string
  getAttrs?: (team: Team, characterId: number) => AttrRecord
}

export function serializeMultiGridState(
  boards: BoardInput[],
  activeId: number,
  displayFlags?: DisplayFlags,
  mode?: string,
): MultiGridState {
  const state: MultiGridState = {
    boards: boards.map((b) => ({
      ...serializeGridState(b.tiles, b.allyArtifact, b.enemyArtifact, undefined, b.getAttrs),
      m: b.map,
    })),
  }
  if (activeId) state.active = activeId
  if (displayFlags) state.d = packDisplayFlags(displayFlags)
  if (mode) state.mode = mode
  return state
}

export function unpackDisplayFlags(packed: number | undefined): Required<DisplayFlags> {
  if (packed === undefined) {
    // Return defaults if no flags are stored
    return {
      showPerspective: true,
      showSkills: true,
      teamView: false,
      inverted: false,
      wrap: false,
    }
  }

  return {
    wrap: !!(packed & (1 << 0)),
    showSkills: !!(packed & (1 << 1)),
    showPerspective: !!(packed & (1 << 2)),
    inverted: !!(packed & (1 << 3)),
    teamView: !!(packed & (1 << 4)),
  }
}
