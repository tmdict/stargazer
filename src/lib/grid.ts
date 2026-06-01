import { PHANTIMAL_ID_OFFSET } from './characters/phantimal'
import { Hex } from './hex'
import { DEFAULT_MAP, type MapConfig } from './maps'
import type { SkillManager } from './skills/skill'
import { FULL_GRID, type GridPreset } from './types/grid'
import { State } from './types/state'
import { Team } from './types/team'

function iniGrid(preset: GridPreset): Hex[] {
  const centerRowIndex = Math.floor(preset.hex.length / 2)
  const hexes: Hex[] = []

  for (let rowIndex = 0; rowIndex < preset.hex.length; rowIndex++) {
    const row = preset.hex[rowIndex]
    const offset = preset.qOffset[rowIndex]

    if (!row || offset === undefined) {
      console.warn('grid: Skipping invalid row/offset in createHexesFromPreset', {
        rowIndex,
        rowExists: !!row,
        offset,
      })
      continue
    }

    const r = rowIndex - centerRowIndex

    for (let i = 0; i < row.length; i++) {
      const q = offset + i
      const s = -q - r
      const id = row[i]
      hexes.push(new Hex(q, r, s, id))
    }
  }

  return hexes
}

export interface GridTile {
  hex: Hex
  state: State
  characterId?: number
  team?: Team
}

export class Grid {
  private storage: Map<string, GridTile>
  // Parallel ID index for O(1) getHexById. Hexes are immutable after construction,
  // so this never needs invalidation.
  private hexById: Map<number, Hex> = new Map()

  // Tracks which character IDs are placed on each team
  teamCharacters: Map<Team, Set<number>> = new Map([
    [Team.ALLY, new Set()],
    [Team.ENEMY, new Set()],
  ])
  maxTeamSizes: Map<Team, number> = new Map([
    [Team.ALLY, 5],
    [Team.ENEMY, 5],
  ])

  // Companion IDs are derived as N * companionIdOffset + mainCharacterId
  companionIdOffset = 10000
  // Phantimals occupy the same unit slot as characters, namespaced above companions.
  phantimalIdOffset = PHANTIMAL_ID_OFFSET
  // Key format: `${mainCharacterId}-${team}` → set of companion character IDs
  companionLinks: Map<string, Set<number>> = new Map()

  skillManager?: SkillManager

  readonly gridPreset: GridPreset

  constructor(layout = FULL_GRID, map: MapConfig = DEFAULT_MAP) {
    this.gridPreset = layout
    this.storage = new Map()
    iniGrid(layout).forEach((hex) => {
      this.storage.set(Grid.key(hex), { hex, state: State.DEFAULT })
      this.hexById.set(hex.getId(), hex)
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
    return Array.from(this.storage.values()).map((entry) => entry.hex)
  }

  getHexById(id: number): Hex {
    const hex = this.hexById.get(id)
    if (!hex) throw new Error(`Hex with ID ${id} not found`)
    return hex
  }

  getTile(hex: Hex): GridTile {
    const tile = this.storage.get(Grid.key(hex))
    if (!tile) throw new Error(`Tile with hex key ${Grid.key(hex)} not found`)
    return tile
  }

  getTileById(hexId: number): GridTile {
    const hex = this.getHexById(hexId)
    return this.getTile(hex)
  }

  getAllTiles(): GridTile[] {
    return Array.from(this.storage.values())
  }

  setState(hex: Hex, state: State): void {
    this.getTile(hex).state = state
  }
}
