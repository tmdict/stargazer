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
  d?: number // display flags: bit-packed (showHexIds, showArrows, showPerspective, showSkills, teamView, inverted)
}

/* The user-facing display toggles carried in the URL's bit-packed `d` field */
export interface DisplayFlags {
  showHexIds?: boolean
  showArrows?: boolean
  showPerspective?: boolean
  showSkills?: boolean
  teamView?: boolean
  inverted?: boolean
}

/* Create compact serialized state for URL generation */
export function serializeGridState(
  allTiles: GridTile[],
  allyArtifact: number | null,
  enemyArtifact: number | null,
  displayFlags?: DisplayFlags,
): GridState {
  const state: GridState = {}

  // Convert tiles to compact format: [hexId, state]
  // Only include non-default tiles (state !== 0)
  const nonDefaultTiles = allTiles
    .filter((tile) => tile.state !== 0)
    .map((tile) => [tile.hex.getId(), tile.state])

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
  if (state.a) result.a = [state.a[1] ?? null, state.a[0] ?? null]
  return result
}

/* Pack the display toggles into one number.
 * Bit 0: showHexIds, 1: showArrows, 2: showPerspective (!Flat), 3: showSkills,
 * 4: teamView, 5: inverted */
export function packDisplayFlags(flags: DisplayFlags): number {
  let packed = 0
  if (flags.showHexIds) packed |= 1 << 0
  if (flags.showArrows) packed |= 1 << 1
  if (flags.showPerspective) packed |= 1 << 2
  if (flags.showSkills) packed |= 1 << 3
  if (flags.teamView) packed |= 1 << 4
  if (flags.inverted) packed |= 1 << 5
  return packed
}

/* Multi-board state (5 v 5): one GridState per board, the active board, and the
 * global display flags. Boards carry their own map via their tile states. */
export interface MultiGridState {
  boards: GridState[]
  active?: number
  d?: number
}

export interface BoardInput {
  tiles: GridTile[]
  allyArtifact: number | null
  enemyArtifact: number | null
}

export function serializeMultiGridState(
  boards: BoardInput[],
  activeId: number,
  displayFlags?: DisplayFlags,
): MultiGridState {
  const state: MultiGridState = {
    boards: boards.map((b) => serializeGridState(b.tiles, b.allyArtifact, b.enemyArtifact)),
  }
  if (activeId) state.active = activeId
  if (displayFlags) state.d = packDisplayFlags(displayFlags)
  return state
}

/* Unpack display flags from bit-packed number */
export function unpackDisplayFlags(packed: number | undefined): Required<DisplayFlags> {
  if (packed === undefined) {
    // Return defaults if no flags are stored
    return {
      showHexIds: true,
      showArrows: true,
      showPerspective: true,
      showSkills: true,
      teamView: false,
      inverted: false,
    }
  }

  return {
    showHexIds: !!(packed & (1 << 0)),
    showArrows: !!(packed & (1 << 1)),
    showPerspective: !!(packed & (1 << 2)),
    showSkills: !!(packed & (1 << 3)),
    teamView: !!(packed & (1 << 4)),
    inverted: !!(packed & (1 << 5)),
  }
}
