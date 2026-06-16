import { isPhantimalId, toLocalPhantimalId } from '@/lib/characters/phantimal'
import type { GridTile } from '@/lib/grid'

/* Ultra-compact format for URL serialization - the ONLY format we support */
export interface GridState {
  t?: number[][] // tiles: [hexId, state] (only non-default states)
  c?: number[][] // characters: [hexId, characterId, team]
  a?: (number | null)[] // artifacts: [ally, enemy] (only if at least one set)
  p?: number[][] // phantimals: [hexId, localPhantimalId, team] (kept out of c, ids 100000+ don't fit the character field)
  d?: number // display flags: bit-packed (showHexIds, showArrows, showPerspective, showSkills, teamView)
}

/* The five user-facing display toggles carried in the URL's bit-packed `d` field */
export interface DisplayFlags {
  showHexIds?: boolean
  showArrows?: boolean
  showPerspective?: boolean
  showSkills?: boolean
  teamView?: boolean
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

/* Pack the five display toggles into one number.
 * Bit 0: showHexIds, 1: showArrows, 2: showPerspective (!Flat), 3: showSkills, 4: teamView */
export function packDisplayFlags(flags: DisplayFlags): number {
  let packed = 0
  if (flags.showHexIds) packed |= 1 << 0
  if (flags.showArrows) packed |= 1 << 1
  if (flags.showPerspective) packed |= 1 << 2
  if (flags.showSkills) packed |= 1 << 3
  if (flags.teamView) packed |= 1 << 4
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
    }
  }

  return {
    showHexIds: !!(packed & (1 << 0)),
    showArrows: !!(packed & (1 << 1)),
    showPerspective: !!(packed & (1 << 2)),
    showSkills: !!(packed & (1 << 3)),
    teamView: !!(packed & (1 << 4)),
  }
}
