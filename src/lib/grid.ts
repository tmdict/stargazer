import { ARENA_1 } from './arena/arena1'
import { Hex } from './hex'
import { clearPathfindingCache } from './pathfinding'
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

  // Cache invalidation batching support
  private batchingCacheClears = false
  private pendingCacheClears = false

  // Skill manager reference for triggering skill updates
  skillManager?: SkillManager

  // Helper method for cache invalidation logic
  private handleCacheInvalidation(skipCacheInvalidation: boolean): void {
    if (skipCacheInvalidation) return

    if (this.batchingCacheClears) {
      this.pendingCacheClears = true
    } else {
      clearPathfindingCache()
      // Trigger skill updates immediately when not batching
      if (this.skillManager) {
        this.skillManager.updateActiveSkills(this)
      }
    }
  }

  readonly gridPreset: GridPreset

  // Constructor & Basic Setup

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

  // Hex & Tile Access Methods

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

  getTilesWithCharacters(): GridTile[] {
    return this.getAllTiles().filter((tile) => tile.characterId !== undefined)
  }

  // Character Query Methods

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

  // Character Placement Methods

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
      this.removeCharacterFromTeam(tile.characterId, tile.team)
    }

    this.setCharacterOnTile(tile, characterId, team)

    // Handle cache invalidation with batching support
    this.handleCacheInvalidation(skipCacheInvalidation)

    return true
  }

  removeCharacter(hexId: number, skipCacheInvalidation: boolean = false): boolean {
    const tile = this.getTileById(hexId)
    if (tile.characterId) {
      const characterId = tile.characterId
      const team = tile.team

      this.removeCharacterFromTeam(characterId, team)
      this.clearCharacterFromTile(tile, hexId)

      // Handle cache invalidation with batching support
      this.handleCacheInvalidation(skipCacheInvalidation)
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
      this.handleCacheInvalidation(false) // Don't skip, but respect batching
      return true
    }

    // Use transaction pattern for atomic clear operation
    return this.executeTransaction(
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
  }

  // Complex Character Operations

  swapCharacters(fromHexId: number, toHexId: number): boolean {
    // Basic validation
    if (fromHexId === toHexId) return false

    // Validate both positions have characters
    const fromOp = this.validateCharacterOperation(fromHexId, true)
    const toOp = this.validateCharacterOperation(toHexId, true)

    if (!fromOp || !toOp) return false

    // Determine target teams from tile states
    const fromTargetTeam = this.getTeamFromTileState(this.getTileById(fromHexId).state)
    const toTargetTeam = this.getTeamFromTileState(this.getTileById(toHexId).state)

    if (!fromTargetTeam || !toTargetTeam) return false

    // Execute swap as transaction
    return this.executeTransaction(
      // Operations to execute
      [
        () => {
          this.removeCharacter(fromHexId, true)
          return true
        },
        () => {
          this.removeCharacter(toHexId, true)
          return true
        },
        () => {
          return this.placeCharacter(fromHexId, toOp.characterId, fromTargetTeam, true)
        },
        () => {
          return this.placeCharacter(toHexId, fromOp.characterId, toTargetTeam, true)
        },
      ],
      // Rollback operations
      [
        () => {
          this.placeCharacter(fromHexId, fromOp.characterId, fromOp.team, true)
        },
        () => {
          this.placeCharacter(toHexId, toOp.characterId, toOp.team, true)
        },
      ],
    )
  }

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

  // Companion Support Methods

  isCompanionId(characterId: number): boolean {
    return characterId >= this.companionIdOffset
  }

  getMainCharacterId(companionId: number): number {
    if (!this.isCompanionId(companionId)) {
      return companionId // Already a main character
    }
    return companionId % this.companionIdOffset
  }

  getCompanions(mainCharacterId: number, team?: Team): Set<number> {
    // If team is provided, get companions for that specific team
    if (team !== undefined) {
      const key = `${mainCharacterId}-${team}`
      return this.companionLinks.get(key) || new Set()
    }

    // If no team provided, get companions from all teams
    const allCompanions = new Set<number>()
    for (const [key, companions] of this.companionLinks.entries()) {
      if (key.startsWith(`${mainCharacterId}-`)) {
        companions.forEach((c) => allCompanions.add(c))
      }
    }
    return allCompanions
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

  findCharacterHex(characterId: number, team?: Team): number | null {
    for (const entry of this.storage.values()) {
      if (entry.characterId === characterId) {
        // If team is specified, only return if it matches
        if (team !== undefined && entry.team !== team) {
          continue
        }
        return entry.hex.getId()
      }
    }
    return null
  }

  clearCompanionLinks(mainCharacterId: number, team?: Team): void {
    if (team !== undefined) {
      // Clear for specific team
      const key = `${mainCharacterId}-${team}`
      this.companionLinks.delete(key)
    } else {
      // Clear for all teams
      const keysToDelete = []
      for (const key of this.companionLinks.keys()) {
        if (key.startsWith(`${mainCharacterId}-`)) {
          keysToDelete.push(key)
        }
      }
      keysToDelete.forEach((key) => this.companionLinks.delete(key))
    }
  }

  getTeamCharacters(team: Team): Set<number> {
    return this.teamCharacters.get(team) || new Set()
  }

  // Private Helper Methods

  getAvailableForTeam(team: Team): number {
    return this.getMaxTeamSize(team) - (this.teamCharacters.get(team)?.size || 0)
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

  private removeCharacterFromTeam(characterId: number, team: Team | undefined): void {
    if (team !== undefined) {
      this.teamCharacters.get(team)?.delete(characterId)
    }
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

  /**
   * Execute a transaction with automatic rollback on failure.
   *
   * @param operations Array of operations that return boolean (true = success)
   * @param rollbackOperations Array of rollback operations to execute on failure
   * @returns true if all operations succeeded, false otherwise
   */
  executeTransaction(
    operations: (() => boolean)[],
    rollbackOperations: (() => void)[] = [],
  ): boolean {
    // Start batching - no cache clears during transaction
    this.batchingCacheClears = true
    this.pendingCacheClears = false

    // Execute all operations
    const results = operations.map((op) => op())

    // Check if any failed
    if (results.some((result) => !result)) {
      // Rollback all operations
      rollbackOperations.forEach((rollback) => rollback())
      this.batchingCacheClears = false

      // Clear cache once after rollback (if any operations were attempted)
      if (this.pendingCacheClears) {
        clearPathfindingCache()
      }
      return false
    }

    // Success - stop batching
    this.batchingCacheClears = false

    // Clear cache ONCE after all operations complete successfully
    if (this.pendingCacheClears) {
      clearPathfindingCache()
    }

    // Trigger skill updates for any active skills
    if (this.skillManager) {
      this.skillManager.updateActiveSkills(this)
    }

    return true
  }

  private performMove(
    fromHexId: number,
    toHexId: number,
    characterId: number,
    targetTeam: Team,
    originalTeam: Team,
  ): boolean {
    return this.executeTransaction(
      // Operations to execute
      [
        () => {
          this.removeCharacter(fromHexId, true)
          return true
        },
        () => this.placeCharacter(toHexId, characterId, targetTeam, true),
      ],
      // Rollback operations
      [() => this.placeCharacter(fromHexId, characterId, originalTeam, true)],
    )
  }
}
