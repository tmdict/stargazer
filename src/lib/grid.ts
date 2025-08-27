import { ARENA_1 } from './arena/arena1'
import { Hex } from './hex'
import type { SkillManager } from './skill'
import { executeTransaction, handleCacheInvalidation } from './transaction'
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

// Character operation interface for transaction management
interface CharacterOperation {
  hexId: number
  characterId: number
  team: Team
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

  // Character Queries
  getCharacter(hexId: number): number | undefined {
    return this.getTileById(hexId).characterId
  }

  hasCharacter(hexId: number): boolean {
    return this.getTileById(hexId).characterId !== undefined
  }

  getCharacterTeam(hexId: number): Team | undefined {
    return this.getTileById(hexId).team
  }

  getCharacterCount(): number {
    let count = 0
    for (const entry of this.storage.values()) {
      if (entry.characterId) {
        count++
      }
    }
    return count
  }

  getCharacterPlacements(): Map<number, number> {
    const placements = new Map<number, number>()
    for (const entry of this.storage.values()) {
      if (entry.characterId) {
        placements.set(entry.hex.getId(), entry.characterId)
      }
    }
    return placements
  }

  getTilesWithCharacters(): GridTile[] {
    return this.getAllTiles().filter((tile) => tile.characterId !== undefined)
  }

  findCharacterHex(characterId: number, team: Team): number | null {
    for (const entry of this.storage.values()) {
      if (entry.characterId === characterId && entry.team === team) {
        return entry.hex.getId()
      }
    }
    return null
  }

  // Character Placement
  placeCharacter(
    hexId: number,
    characterId: number,
    team: Team = Team.ALLY,
    skipCacheInvalidation: boolean = false,
  ): boolean {
    // Input validation
    if (!Number.isInteger(characterId) || characterId <= 0) return false

    if (!this.canPlaceCharacterOnTile(hexId, team)) return false
    if (!this.canPlaceCharacter(characterId, team)) return false

    const tile = this.getTileById(hexId)

    if (tile.characterId) {
      if (!tile.team) {
        console.error(`Tile has characterId ${tile.characterId} but no team`)
        return false
      }
      this.removeCharacterFromTeam(tile.characterId, tile.team)
    }

    this.setCharacterOnTile(tile, characterId, team)

    // Handle cache invalidation with batching support
    handleCacheInvalidation(skipCacheInvalidation, this.skillManager, this)

    return true
  }

  removeCharacter(hexId: number, skipCacheInvalidation: boolean = false): boolean {
    const tile = this.getTileById(hexId)
    if (tile.characterId) {
      if (!tile.team) {
        console.error(`Tile at hex ${hexId} has characterId ${tile.characterId} but no team`)
        return false
      }
      const characterId = tile.characterId
      const team = tile.team

      this.removeCharacterFromTeam(characterId, team)
      this.clearCharacterFromTile(tile, hexId)

      // Handle cache invalidation with batching support
      handleCacheInvalidation(skipCacheInvalidation, this.skillManager, this)
      return true
    }
    return false
  }

  clearAllCharacters(): boolean {
    // Collect all current placements for potential rollback
    const currentPlacements = this.getTilesWithCharacters().map((tile) => ({
      hexId: tile.hex.getId(),
      characterId: tile.characterId!,
      team: tile.team!,
    }))

    // If no characters to clear, return success immediately
    if (currentPlacements.length === 0) {
      handleCacheInvalidation(false, this.skillManager, this) // Don't skip, but respect batching
      return true
    }

    // Use transaction pattern for atomic clear operation
    const result = executeTransaction(
      // Operations to execute
      [
        () => {
          // Clear all character data
          for (const entry of this.storage.values()) {
            if (entry.characterId) {
              this.clearCharacterFromTile(entry, entry.hex.getId())
            }
          }
          this.teamCharacters.get(Team.ALLY)?.clear()
          this.teamCharacters.get(Team.ENEMY)?.clear()
          return true
        },
      ],
      // Rollback operations - restore all characters
      [
        () => {
          currentPlacements.forEach((placement) => {
            this.placeCharacter(placement.hexId, placement.characterId, placement.team, true)
          })
        },
      ],
    )

    // Trigger skill updates after successful transaction
    if (result && this.skillManager) {
      this.skillManager.updateActiveSkills(this)
    }

    return result
  }

  autoPlaceCharacter(characterId: number, team: Team): boolean {
    // Validate character can be placed
    if (!this.canPlaceCharacter(characterId, team)) return false

    // Get all available tiles for this team
    const availableTiles = this.getAllAvailableTilesForTeam(team)
    if (availableTiles.length === 0) return false

    // Sort by hex ID descending (largest first) for deterministic randomness
    availableTiles.sort((a, b) => b.hex.getId() - a.hex.getId())

    // Select random tile from available options
    const randomIndex = Math.floor(Math.random() * availableTiles.length)
    const selectedTile = availableTiles[randomIndex]

    if (!selectedTile) {
      console.error('grid: Selected tile is undefined despite non-empty availableTiles array', {
        randomIndex,
        availableTilesLength: availableTiles.length,
      })
      return false
    }

    // Place character using existing validated method
    return this.placeCharacter(selectedTile.hex.getId(), characterId, team)
  }

  // Character Movement
  moveCharacter(fromHexId: number, toHexId: number, characterId: number): boolean {
    // Basic validation
    if (fromHexId === toHexId) return false

    // Validate that the character at fromHexId matches the characterId parameter
    const actualCharacterId = this.getCharacter(fromHexId)
    if (actualCharacterId !== characterId) return false

    // Validate source position
    const fromOp = this.validateCharacterOperation(fromHexId)
    if (!fromOp) return false

    // Determine target team
    const targetTeam = this.getTeamFromTileState(this.getTileById(toHexId).state)
    if (!targetTeam) return false

    // Execute move using unified transaction logic
    return this.performMove(fromHexId, toHexId, characterId, targetTeam, fromOp.team)
  }

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

  canPlaceCharacter(characterId: number, team: Team): boolean {
    const available = this.getAvailableForTeam(team)
    const hasCharacter = this.teamCharacters.get(team)?.has(characterId)
    if (available <= 0) return false
    return !hasCharacter
  }

  canPlaceCharacterOnTile(hexId: number, team: Team): boolean {
    const tile = this.getTileById(hexId)
    const state = tile.state
    const availableState = team === Team.ALLY ? State.AVAILABLE_ALLY : State.AVAILABLE_ENEMY
    const occupiedState = team === Team.ALLY ? State.OCCUPIED_ALLY : State.OCCUPIED_ENEMY

    return state === availableState || state === occupiedState
  }

  getTeamCharacters(team: Team): Set<number> {
    return this.teamCharacters.get(team) || new Set()
  }

  getAvailableForTeam(team: Team): number {
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

  // Helper Methods

  private performMove(
    fromHexId: number,
    toHexId: number,
    characterId: number,
    targetTeam: Team,
    originalTeam: Team,
  ): boolean {
    const result = executeTransaction(
      // Operations to execute
      [
        () => {
          return this.removeCharacter(fromHexId, true)
        },
        () => this.placeCharacter(toHexId, characterId, targetTeam, true),
      ],
      // Rollback operations
      [() => this.placeCharacter(fromHexId, characterId, originalTeam, true)],
    )

    // Trigger skill updates after successful transaction
    if (result && this.skillManager) {
      this.skillManager.updateActiveSkills(this)
    }

    return result
  }

  // Private Helper Methods
  private removeCharacterFromTeam(characterId: number, team: Team): void {
    this.teamCharacters.get(team)?.delete(characterId)
  }

  private setCharacterOnTile(tile: GridTile, characterId: number, team: Team): void {
    tile.characterId = characterId
    tile.team = team
    tile.state = team === Team.ALLY ? State.OCCUPIED_ALLY : State.OCCUPIED_ENEMY
    this.teamCharacters.get(team)?.add(characterId)
  }

  private clearCharacterFromTile(tile: GridTile, hexId: number): void {
    delete tile.characterId
    delete tile.team
    tile.state = this.getOriginalTileState(hexId)
  }

  private getOriginalTileState(hexId: number): State {
    const tile = this.getTileById(hexId)
    const currentState = tile.state

    if (currentState === State.OCCUPIED_ALLY) {
      return State.AVAILABLE_ALLY
    } else if (currentState === State.OCCUPIED_ENEMY) {
      return State.AVAILABLE_ENEMY
    }

    return currentState
  }

  private getTeamFromTileState(state: State): Team | null {
    if (state === State.AVAILABLE_ALLY || state === State.OCCUPIED_ALLY) {
      return Team.ALLY
    } else if (state === State.AVAILABLE_ENEMY || state === State.OCCUPIED_ENEMY) {
      return Team.ENEMY
    }
    return null
  }

  private getAllAvailableTilesForTeam(team: Team): GridTile[] {
    return Array.from(this.storage.values()).filter(
      (tile) => this.canPlaceCharacterOnTile(tile.hex.getId(), team) && !tile.characterId,
    )
  }

  private validateCharacterOperation(
    hexId: number,
    requireCharacter: boolean = false,
  ): CharacterOperation | null {
    const characterId = this.getCharacter(hexId)
    const team = this.getCharacterTeam(hexId)

    if (requireCharacter && (!characterId || team === undefined)) {
      return null
    }

    return {
      hexId,
      characterId: characterId || 0,
      team: team ?? Team.ALLY,
    }
  }
}
