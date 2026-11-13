import { Hex } from './hex'
import { DEFAULT_MAP, type MapConfig } from './maps'
import { FULL_GRID, presetHexes } from './types/grid'
import { State } from './types/state'
import { Team } from './types/team'

// Per-team unit capacity before any skill raises it (companion skills bump it
// by their companion count while active)
export const BASE_TEAM_SIZE = 5

export interface GridTile {
  hex: Hex
  state: State
  characterId: number | undefined
  team: Team | undefined
}

export class Grid {
  private storage: Map<string, GridTile>
  // Parallel ID indexes for O(1) getHexById and getTileById, and the tiles in
  // storage order for getAllTiles. Tiles are created only in the constructor, so
  // these never need invalidation.
  private hexById: Map<number, Hex> = new Map()
  private tileById: Map<number, GridTile> = new Map()
  private tiles: GridTile[] = []

  maxTeamSizes: Map<Team, number> = new Map([
    [Team.ALLY, BASE_TEAM_SIZE],
    [Team.ENEMY, BASE_TEAM_SIZE],
  ])

  // Key format: `${mainCharacterId}-${team}` → set of companion character IDs
  companionLinks: Map<string, Set<number>> = new Map()

  constructor(layout = FULL_GRID, map: MapConfig = DEFAULT_MAP) {
    this.storage = new Map()
    presetHexes(layout).forEach((hex) => {
      const tile: GridTile = { hex, state: State.DEFAULT, characterId: undefined, team: undefined }
      this.storage.set(Grid.key(hex), tile)
      this.hexById.set(hex.getId(), hex)
      this.tileById.set(hex.getId(), tile)
      this.tiles.push(tile)
    })
    map.grid.forEach((mapState) => {
      mapState.hex.forEach((hexId) => {
        const hex = this.getHexById(hexId)
        this.setState(hex, mapState.type)
      })
    })
  }

  private static key(hex: Hex): string {
    return `${hex.q},${hex.r},${hex.s}`
  }

  keys(): Hex[] {
    return this.tiles.map((entry) => entry.hex)
  }

  getHexById(id: number): Hex {
    const hex = this.hexById.get(id)
    if (!hex) throw new Error(`Hex with ID ${id} not found`)
    return hex
  }

  // Non-throwing twin of getHexById for ids read from untrusted serialized data
  getHexByIdOrUndefined(id: number): Hex | undefined {
    return this.hexById.get(id)
  }

  // Non-throwing lookup for probing hexes that may lie outside the grid
  // (pathfinding callbacks, neighbor scans)
  getTileOrUndefined(hex: Hex): GridTile | undefined {
    return this.storage.get(Grid.key(hex))
  }

  getTile(hex: Hex): GridTile {
    const tile = this.storage.get(Grid.key(hex))
    if (!tile) throw new Error(`Tile with hex key ${Grid.key(hex)} not found`)
    return tile
  }

  getTileById(hexId: number): GridTile {
    const tile = this.tileById.get(hexId)
    if (!tile) throw new Error(`Hex with ID ${hexId} not found`)
    return tile
  }

  getAllTiles(): readonly GridTile[] {
    return this.tiles
  }

  setState(hex: Hex, state: State): void {
    this.getTile(hex).state = state
  }
}

// Artifact host cells: the off-grid hexes beside the arena's corner cells, left
// of cell 1 (ally) and right of cell 45 (enemy). They hold no tile, so
// placement, pathfinding, and targeting never see them; rendering and artifact
// arrows anchor on them.
const ARTIFACT_HOST_CELLS = {
  [Team.ALLY]: { anchor: 1, direction: 4 },
  [Team.ENEMY]: { anchor: 45, direction: 1 },
} as const

export function artifactHostHex(grid: Grid, team: Team): Hex {
  const { anchor, direction } = ARTIFACT_HOST_CELLS[team]
  return grid.getHexById(anchor).neighbor(direction)
}

// 180-degree rotation about the board center, the content-level counterpart of
// the view-only Invert toggle: negating all three cube coordinates maps a
// formation onto the opposite side. Undefined for an unknown id or a rotated
// position off the grid.
export function rotatedHexId(grid: Grid, hexId: number): number | undefined {
  const hex = grid.getHexByIdOrUndefined(hexId)
  if (!hex) return undefined
  return grid.getTileOrUndefined(new Hex(-hex.q, -hex.r, -hex.s))?.hex.getId()
}
