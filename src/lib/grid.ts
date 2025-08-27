import { ARENA_1 } from './arena/arena1'
import { Hex } from './hex'
import type { SkillManager } from './skill'
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
  private teamCharacters: Map<Team, Set<number>> = new Map([
    [Team.ALLY, new Set()],
    [Team.ENEMY, new Set()],
  ])
  private maxTeamSizes: Map<Team, number> = new Map([
    [Team.ALLY, 5],
    [Team.ENEMY, 5],
  ])

  // Companion support
  private companionIdOffset = 10000
  // Changed to include team in the key: "mainId-team" -> Set of companions
  private companionLinks: Map<string, Set<number>> = new Map()

  // Skill manager reference for triggering skill updates
  skillManager?: SkillManager

  readonly gridPreset: GridPreset

  // Core Grid Operations

  constructor(layout = FULL_GRID, map = ARENA_1) {
    this.gridPreset = layout
    this.storage = new Map()
    iniGrid(layout).forEach((hex) => {
      this.storage.set(Grid.key(hex), { hex, state: State.DEFAULT })
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
    const hex = Array.from(this.storage.values()).find((entry) => entry.hex.getId() === id)?.hex
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

  setState(hex: Hex, state: State): boolean {
    if (!Object.values(State).includes(state)) {
      return false // Invalid state
    }
    const tile = this.getTile(hex)
    if (tile) {
      tile.state = state
      return true
    }
    return false
  }

  // Character Operations


  // Team Management

  getMaxTeamSize(team: Team): number {
    return this.maxTeamSizes.get(team) || 5
  }

  setMaxTeamSize(team: Team, size: number): boolean {
    const maxPossibleSize = this.getAllTiles().length
    if (!Number.isInteger(size) || size <= 0 || size > maxPossibleSize) {
      return false // Invalid input
    }
    this.maxTeamSizes.set(team, size)
    return true
  }


  getTeamCharacters(team: Team): Set<number> {
    return this.teamCharacters.get(team) || new Set()
  }

  isCharacterOnTeam(characterId: number, team: Team): boolean {
    return this.teamCharacters.get(team)?.has(characterId) || false
  }

  getAvailableTeamSize(team: Team): number {
    return this.getMaxTeamSize(team) - (this.teamCharacters.get(team)?.size || 0)
  }

  // Companion System

  isCompanionId(characterId: number): boolean {
    return characterId >= this.companionIdOffset
  }

  getMainCharacterId(companionId: number): number {
    if (!this.isCompanionId(companionId)) {
      return companionId // Already a main character
    }
    return companionId % this.companionIdOffset
  }

  getCompanions(mainCharacterId: number, team: Team): Set<number> {
    const key = `${mainCharacterId}-${team}`
    return this.companionLinks.get(key) || new Set()
  }

  addCompanionLink(mainId: number, companionId: number, team: Team): void {
    const key = `${mainId}-${team}`
    if (!this.companionLinks.has(key)) {
      this.companionLinks.set(key, new Set())
    }
    this.companionLinks.get(key)!.add(companionId)
  }

  removeCompanionLink(mainId: number, companionId: number, team: Team): void {
    const key = `${mainId}-${team}`
    const companions = this.companionLinks.get(key)
    if (companions) {
      companions.delete(companionId)
      if (companions.size === 0) {
        this.companionLinks.delete(key)
      }
    }
  }

  clearCompanionLinks(mainCharacterId: number, team: Team): void {
    const key = `${mainCharacterId}-${team}`
    this.companionLinks.delete(key)
  }
}
