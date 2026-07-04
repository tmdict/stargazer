import { isBaseHeroId } from '@/lib/characters/character'
import { isPhantimalId, toLocalPhantimalId } from '@/lib/characters/phantimal'
import type { GridTile } from '@/lib/grid'
import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'

/* Ultra-compact format for URL serialization - the ONLY format we support */
export interface GridState {
  t?: number[][] // tiles: [hexId, state] (only non-default states)
  c?: number[][] // characters: [hexId, characterId, team]
  a?: (number | null)[] // artifacts: [ally, enemy] (only if at least one set)
  p?: number[][] // phantimals: [hexId, localPhantimalId, team] (kept out of c, ids 100000+ don't fit the character field)
  pr?: number[][] // paragon: [team, characterId, level] for placed heroes with level > 0
  d?: number // display flags: bit-packed (showGridInfo, showArrows, showPerspective, showSkills, teamView, inverted)
}

/* The user-facing display toggles carried in the URL's bit-packed `d` field */
export interface DisplayFlags {
  showGridInfo?: boolean
  showArrows?: boolean
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
  getParagon?: (team: Team, characterId: number) => number,
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

  // Extract characters from tiles that have them (phantimals are serialized
  // separately so the character section keeps its compact 16-bit id field).
  const characters = allTiles
    .filter(
      (tile) => tile.characterId && tile.team !== undefined && !isPhantimalId(tile.characterId),
    )
    .map((tile) => [tile.hex.getId(), tile.characterId!, tile.team!])

  if (characters.length > 0) {
    state.c = characters
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
    state.p = phantimals
  }

  // Paragon levels keyed by team + character; only base heroes carry them and only
  // non-zero levels are emitted.
  if (getParagon) {
    const paragons = allTiles
      .filter(
        (tile) =>
          tile.characterId !== undefined &&
          tile.team !== undefined &&
          isBaseHeroId(tile.characterId),
      )
      .map((tile) => [tile.team!, tile.characterId!, getParagon(tile.team!, tile.characterId!)])
      .filter((entry) => entry[2]! > 0)
    if (paragons.length > 0) {
      state.pr = paragons
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

/* Reflect a board's units onto the opposite team at their mirror tiles. The map
 * itself doesn't move: tile states stay at their hexes but occupied ones are
 * demoted to available (occupancy is re-established by the mirrored `c`/`p`
 * placements). Character and phantimal hexes are mirrored (via the injected
 * `mirror`, so this stays grid-agnostic) with teams flipped, artifact slots swap,
 * and display flags pass through. Entries whose mirror is off-grid (asymmetric
 * custom maps) are dropped. */
export function mirrorGridState(
  state: GridState,
  mirror: (hexId: number) => number | undefined,
): GridState {
  const flip = (team: number): number => (team === Team.ALLY ? Team.ENEMY : Team.ALLY)
  const mirrorEntry = (entry: number[]): number[] | null => {
    const dest = mirror(entry[0])
    return dest === undefined ? null : [dest, entry[1], flip(entry[2])]
  }
  const vacate = (s: number): number =>
    s === State.OCCUPIED_ALLY
      ? State.AVAILABLE_ALLY
      : s === State.OCCUPIED_ENEMY
        ? State.AVAILABLE_ENEMY
        : s

  const result: GridState = {}
  if (state.t) result.t = state.t.map((entry) => [entry[0], vacate(entry[1])])
  if (state.d !== undefined) result.d = state.d
  const c = state.c?.map(mirrorEntry).filter((e): e is number[] => e !== null)
  if (c?.length) result.c = c
  const p = state.p?.map(mirrorEntry).filter((e): e is number[] => e !== null)
  if (p?.length) result.p = p
  // Paragon is keyed by team + character, not hex, so flip the team; drop any whose
  // hero fell off-grid in the c mirror, so no level outlives its character.
  const survivors = new Set((c ?? []).map((entry) => `${entry[2]!}:${entry[1]!}`))
  const pr = state.pr
    ?.map((entry) => [flip(entry[0]!), entry[1]!, entry[2]!])
    .filter((entry) => survivors.has(`${entry[0]!}:${entry[1]!}`))
  if (pr?.length) result.pr = pr
  if (state.a) result.a = [state.a[1] ?? null, state.a[0] ?? null]
  return result
}

/* Pack the display toggles into one number.
 * Bit 0: showGridInfo, 1: showArrows, 2: showPerspective (!Flat), 3: showSkills,
 * 4: teamView, 5: inverted, 6: wrap */
export function packDisplayFlags(flags: DisplayFlags): number {
  let packed = 0
  if (flags.showGridInfo) packed |= 1 << 0
  if (flags.showArrows) packed |= 1 << 1
  if (flags.showPerspective) packed |= 1 << 2
  if (flags.showSkills) packed |= 1 << 3
  if (flags.teamView) packed |= 1 << 4
  if (flags.inverted) packed |= 1 << 5
  if (flags.wrap) packed |= 1 << 6
  return packed
}

/* One board's GridState plus its map key, so a restore can rebuild the board on
 * the map it was configured with (tile states carry only the edits). */
export type BoardState = GridState & { m?: string }

/* Multi-board state (Teams page): one BoardState per board, the active board,
 * the global display flags, and the team mode the boards belong to. `mode` is
 * always written by the serializer but optional on decode (links predating it
 * infer their mode from the board count — see lib/teams/modes.ts). */
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
  getParagon?: (team: Team, characterId: number) => number
}

export function serializeMultiGridState(
  boards: BoardInput[],
  activeId: number,
  displayFlags?: DisplayFlags,
  mode?: string,
): MultiGridState {
  const state: MultiGridState = {
    boards: boards.map((b) => ({
      ...serializeGridState(b.tiles, b.allyArtifact, b.enemyArtifact, undefined, b.getParagon),
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
      showGridInfo: true,
      showArrows: true,
      showPerspective: true,
      showSkills: true,
      teamView: false,
      inverted: false,
      wrap: false,
    }
  }

  return {
    showGridInfo: !!(packed & (1 << 0)),
    showArrows: !!(packed & (1 << 1)),
    showPerspective: !!(packed & (1 << 2)),
    showSkills: !!(packed & (1 << 3)),
    teamView: !!(packed & (1 << 4)),
    inverted: !!(packed & (1 << 5)),
    wrap: !!(packed & (1 << 6)),
  }
}
