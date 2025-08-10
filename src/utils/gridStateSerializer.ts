import type { GridTile } from '../lib/grid'

/* Ultra-compact format for URL serialization - the ONLY format we support */
export interface GridState {
  t?: number[][] // tiles: [hexId, state] (only non-default states)
  c?: number[][] // characters: [hexId, characterId, team]
  a?: (number | null)[] // artifacts: [ally, enemy] (only if at least one set)
  d?: number // display flags: bit-packed (showHexIds, showArrows, showPerspective)
  mapId?: number // map ID: 1-5 for arena1-arena5 (encoded in binary)
}

/* Create compact serialized state for URL generation */
export function serializeGridState(
  allTiles: GridTile[],
  allyArtifact: number | null,
  enemyArtifact: number | null,
  displayFlags?: { showHexIds?: boolean; showArrows?: boolean; showPerspective?: boolean },
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

  // Extract characters from tiles that have them
  const characters = allTiles
    .filter((tile) => tile.characterId && tile.team !== undefined)
    .map((tile) => [tile.hex.getId(), tile.characterId!, tile.team!])

  if (characters.length > 0) {
    state.c = characters
  }

  // Convert artifacts to compact format: [ally, enemy]
  // Only include if at least one artifact is set
  if (allyArtifact !== null || enemyArtifact !== null) {
    state.a = [allyArtifact, enemyArtifact]
  }

  // Pack display flags into a single number using bit flags
  // Bit 0: showHexIds (Grid Info)
  // Bit 1: showArrows (Targeting)
  // Bit 2: showPerspective (!Flat)
  if (displayFlags) {
    let packed = 0
    if (displayFlags.showHexIds) packed |= 1 << 0
    if (displayFlags.showArrows) packed |= 1 << 1
    if (displayFlags.showPerspective) packed |= 1 << 2
    // Always include display flags even if 0 (all false)
    state.d = packed
  }

  return state
}

/* Unpack display flags from bit-packed number */
export function unpackDisplayFlags(packed: number | undefined): {
  showHexIds: boolean
  showArrows: boolean
  showPerspective: boolean
} {
  if (packed === undefined) {
    // Return defaults if no flags are stored
    return {
      showHexIds: true,
      showArrows: true,
      showPerspective: true,
    }
  }

  return {
    showHexIds: !!(packed & (1 << 0)),
    showArrows: !!(packed & (1 << 1)),
    showPerspective: !!(packed & (1 << 2)),
  }
}
