import { findCharacterHex } from '../characters/character'
import type { Grid } from '../grid'
import type { State } from '../types/state'
import type { Team } from '../types/team'
// Underscore imports use SkillBase<unknown>, wrapped below with Skill = SkillBase<SkillContext>
import {
  getCharacterSkill as _getCharacterSkill,
  registerSkill as _registerSkill,
  hasCompanionSkill,
  hasSkill,
  type SkillBase,
} from './registry'

export { hasCompanionSkill, hasSkill }

// Resolvers for data-store facts a skill may need about any grid unit, keyed by
// characterId (companion -> main character, phantimal -> seasonal). Injected as one
// bag so a new fact is added in a single place rather than threaded through the
// SkillManager constructor and every SkillContext. Each is optional so hand-built
// test contexts can supply only what they read.
export interface SkillLookups {
  factionOf?: (characterId: number) => string | undefined
  classOf?: (characterId: number) => string | undefined
}

// SkillContext defined here (not registry.ts) to avoid circular dep, as it references SkillManager
export interface SkillContext {
  grid: Grid
  hexId: number
  team: Team
  characterId: number
  skillManager: SkillManager
  lookups?: SkillLookups
}

// A tile a skill paints. `fill` routes the color to the cell-fill channel (a
// tint blended over the tile background); the default paints the cell border.
export interface TilePaint {
  hexId: number
  color: string
  fill?: boolean
}

// A straight connection line a skill draws between two hexes (border to border).
export interface SkillLine {
  fromHexId: number
  toHexId: number
  color: string
}

export interface SkillTargetInfo {
  targetHexId: number | null
  targetCharacterId: number | null
  metadata?: {
    arrows?: Array<{
      fromHexId: number
      toHexId: number
      type?: 'ally' | 'enemy'
    }>
    sourceHexId?: number
    allyHexId?: number
    enemyHexId?: number
    distance?: number
    examinedTiles?: number[]
    symmetricalHexId?: number
    isSymmetricalTarget?: boolean
    isRearmostTarget?: boolean
    isFrontmostTarget?: boolean
    isRowTarget?: boolean
    isRowScanTarget?: boolean
  }
}

// Concrete skill type for character implementations
export type Skill = SkillBase<SkillContext>

// Typed wrappers binding SkillContext to generic registry functions
export function getCharacterSkill(characterId: number): Skill | undefined {
  return _getCharacterSkill<SkillContext>(characterId)
}

export function registerSkill(skill: Skill): void {
  _registerSkill<SkillContext>(skill)
}

export class SkillManager {
  // Track which characters have active skills on which hexes
  // Key is "characterId-team" to allow same character on different teams
  private activeSkills: Record<string, { characterId: number; hexId: number; team: Team }> = {}
  // Track color modifiers for specific characters (for companions)
  // Key is "characterId-team" to support same companion ID on different teams
  private characterColorModifiers: Record<string, string> = {}
  // Track image modifiers for specific characters (for companions with custom images)
  // Key is "characterId-team" to support same companion ID on different teams
  private characterImageModifiers: Record<string, string> = {}
  // Two independent tile-paint channels, each keyed by hex id and holding the
  // colors painted there: borders render as the tile stroke, fills as a tinted
  // cell fill. A skill picks one (see TilePaint.fill).
  private tileColorModifiers: Map<number, string[]> = new Map()
  private tileFillModifiers: Map<number, string[]> = new Map()
  // Track original states of tiles altered by skills. A tile may be claimed by
  // several skills at once (e.g. both teams' zone skills overlap); the original
  // state is captured at first claim and restored when the last claim is released
  private tileStateClaims: Map<number, { originalState: State; claimants: Set<string> }> = new Map()
  // Track skill targeting information
  private skillTargets: Map<string, SkillTargetInfo> = new Map()
  // Tiles each skill instance (characterId-team) has painted, for diff-based cleanup
  private skillPaintedTiles: Map<string, TilePaint[]> = new Map()
  // Connection lines each skill instance draws (rendered by SkillTargeting)
  private skillLines: Map<string, SkillLine[]> = new Map()
  // Version counter to trigger reactivity
  private targetVersion = 0

  // Lookups are injected (that data lives in the data store, outside this pure lib);
  // they default to empty so SkillManager stays constructible in isolation.
  constructor(private readonly lookups: SkillLookups = {}) {}

  private getSkillKey(characterId: number, team: Team): string {
    return `${characterId}-${team}`
  }

  hasActiveSkill(characterId: number, team?: Team): boolean {
    if (team !== undefined) {
      return this.getSkillKey(characterId, team) in this.activeSkills
    }
    // Check if character has skill on any team
    for (const info of Object.values(this.activeSkills)) {
      if (info.characterId === characterId) return true
    }
    return false
  }

  getActiveSkillInfo(characterId: number, team?: Team): { hexId: number; team: Team } | undefined {
    if (team !== undefined) {
      const info = this.activeSkills[this.getSkillKey(characterId, team)]
      return info ? { hexId: info.hexId, team: info.team } : undefined
    }
    // Find skill info for character on any team
    for (const info of Object.values(this.activeSkills)) {
      if (info.characterId === characterId) {
        return { hexId: info.hexId, team: info.team }
      }
    }
    return undefined
  }

  activateCharacterSkill(characterId: number, hexId: number, team: Team, grid: Grid): boolean {
    // Check if character has a skill
    const skill = getCharacterSkill(characterId)
    if (!skill) return true // No skill to activate, consider it success

    const skillKey = this.getSkillKey(characterId, team)

    // If already active on THIS team, deactivate first
    if (this.hasActiveSkill(characterId, team)) {
      this.deactivateCharacterSkill(characterId, hexId, team, grid)
    }

    // Track the active skill
    this.activeSkills[skillKey] = { characterId, hexId, team }

    // Create context and activate
    const context: SkillContext = {
      grid,
      hexId,
      team,
      characterId,
      skillManager: this,
      lookups: this.lookups,
    }

    try {
      skill.onActivate(context)
      return true
    } catch (error) {
      console.error('Skill activation failed:', error)
      // Rollback tracking on failure
      delete this.activeSkills[skillKey]
      return false
    }
  }

  deactivateCharacterSkill(characterId: number, hexId: number, team: Team, grid: Grid): void {
    const skill = getCharacterSkill(characterId)
    if (!skill) {
      return
    }

    const skillKey = this.getSkillKey(characterId, team)

    // Remove from tracking
    delete this.activeSkills[skillKey]

    // Create context and deactivate
    const context: SkillContext = {
      grid,
      hexId,
      team,
      characterId,
      skillManager: this,
      lookups: this.lookups,
    }

    skill.onDeactivate(context)
  }

  // Clear all active skills (used when clearing all characters)
  deactivateAllSkills(grid: Grid): void {
    // Create a copy to iterate over since we'll be modifying the object
    const activeSkillsCopy = { ...this.activeSkills }

    Object.values(activeSkillsCopy).forEach(({ characterId, hexId, team }) => {
      this.deactivateCharacterSkill(characterId, hexId, team, grid)
    })
  }

  // Reset all state (used when switching maps)
  reset(): void {
    this.activeSkills = {}
    this.characterColorModifiers = {}
    this.characterImageModifiers = {}
    this.tileColorModifiers.clear()
    this.tileFillModifiers.clear()
    this.tileStateClaims.clear()
    this.skillTargets.clear()
    this.skillPaintedTiles.clear()
    this.skillLines.clear()
    this.targetVersion++ // Trigger reactivity to clear UI
  }

  // Claim a tile a skill is about to alter. The first claim records the tile's
  // original state; later claimants share it (their "current" reading would
  // already be skill-altered). Claims are per skill instance (character + team)
  claimTileState(hexId: number, characterId: number, team: Team, originalState: State): void {
    const claimant = this.getSkillKey(characterId, team)
    const entry = this.tileStateClaims.get(hexId)
    if (entry) {
      entry.claimants.add(claimant)
    } else {
      this.tileStateClaims.set(hexId, { originalState, claimants: new Set([claimant]) })
    }
  }

  // Release a claim on a tile. Returns the original state once the last
  // claimant releases (the caller restores the tile); undefined while other
  // claims remain or if the caller held no claim
  releaseTileState(hexId: number, characterId: number, team: Team): State | undefined {
    const entry = this.tileStateClaims.get(hexId)
    if (!entry || !entry.claimants.delete(this.getSkillKey(characterId, team))) {
      return undefined
    }
    if (entry.claimants.size > 0) return undefined
    this.tileStateClaims.delete(hexId)
    return entry.originalState
  }

  // A tile's pre-skill state: the original captured when a skill first claimed
  // it, else `currentState`. Lets the map be serialized without baked-in skill
  // effects, which a skill re-derives when its character is re-placed.
  getBaseTileState(hexId: number, currentState: State): State {
    return this.tileStateClaims.get(hexId)?.originalState ?? currentState
  }

  // Add color modifier for a specific character (used by skills for companions)
  addCharacterColorModifier(characterId: number, team: Team, color: string): void {
    const key = this.getSkillKey(characterId, team)
    this.characterColorModifiers[key] = color
  }

  // Remove color modifier for a specific character
  removeCharacterColorModifier(characterId: number, team: Team): void {
    const key = this.getSkillKey(characterId, team)
    delete this.characterColorModifiers[key]
  }

  // Add image modifier for a specific character (used by skills for companions)
  addCharacterImageModifier(characterId: number, team: Team, imageName: string): void {
    const key = this.getSkillKey(characterId, team)
    this.characterImageModifiers[key] = imageName
  }

  // Remove image modifier for a specific character
  removeCharacterImageModifier(characterId: number, team: Team): void {
    const key = this.getSkillKey(characterId, team)
    delete this.characterImageModifiers[key]
  }

  // Get all character image modifiers (exposed for UI reactivity)
  getImageModifiersByCharacterAndTeam(): Map<string, string> {
    const modifiers = new Map<string, string>()
    for (const [key, imageName] of Object.entries(this.characterImageModifiers)) {
      modifiers.set(key, imageName)
    }
    return modifiers
  }

  // Both paint channels support multiple colors per tile and share these helpers.
  private addTileColor(map: Map<number, string[]>, hexId: number, color: string): void {
    const existing = map.get(hexId)
    if (existing) {
      if (!existing.includes(color)) existing.push(color)
    } else {
      map.set(hexId, [color])
    }
    this.targetVersion++ // Trigger reactivity
  }

  private removeTileColor(map: Map<number, string[]>, hexId: number, color: string): void {
    const existing = map.get(hexId)
    if (!existing) return
    const index = existing.indexOf(color)
    if (index !== -1) existing.splice(index, 1)
    if (existing.length === 0) map.delete(hexId)
    this.targetVersion++ // Trigger reactivity
  }

  // Border channel
  setTileColorModifier(hexId: number, color: string): void {
    this.addTileColor(this.tileColorModifiers, hexId, color)
  }

  removeTileColorModifier(hexId: number, color: string): void {
    this.removeTileColor(this.tileColorModifiers, hexId, color)
  }

  getTileColorModifier(hexId: number): string[] | undefined {
    const colors = this.tileColorModifiers.get(hexId)
    return colors && colors.length > 0 ? colors : undefined
  }

  getTileColorModifiers(): Map<number, string[]> {
    return new Map(this.tileColorModifiers)
  }

  clearTileColorModifiers(): void {
    this.tileColorModifiers.clear()
    this.targetVersion++ // Trigger reactivity
  }

  // Fill channel
  setTileFillModifier(hexId: number, color: string): void {
    this.addTileColor(this.tileFillModifiers, hexId, color)
  }

  removeTileFillModifier(hexId: number, color: string): void {
    this.removeTileColor(this.tileFillModifiers, hexId, color)
  }

  getTileFillModifier(hexId: number): string[] | undefined {
    const colors = this.tileFillModifiers.get(hexId)
    return colors && colors.length > 0 ? colors : undefined
  }

  getTileFillModifiers(): Map<number, string[]> {
    return new Map(this.tileFillModifiers)
  }

  // Paint exactly `tiles` for this skill instance, first removing the tiles it
  // painted on the previous call (the diff) so a repaint moves/recolors the
  // highlight cleanly. Shared by every tile-highlight skill (withTilePaint,
  // reinier, ...) so the set/remove/track cycle lives in one place.
  paintTiles(characterId: number, team: Team, tiles: TilePaint[]): void {
    const key = this.getSkillKey(characterId, team)
    for (const tile of this.skillPaintedTiles.get(key) ?? []) this.unpaintTile(tile)
    for (const tile of tiles) this.paintTile(tile)
    this.skillPaintedTiles.set(key, tiles)
  }

  clearPaintedTiles(characterId: number, team: Team): void {
    const key = this.getSkillKey(characterId, team)
    for (const tile of this.skillPaintedTiles.get(key) ?? []) this.unpaintTile(tile)
    this.skillPaintedTiles.delete(key)
  }

  // A paint's `fill` flag selects its channel for both apply and cleanup, so a
  // tile is always removed from the same channel it was added to.
  private paintTile(tile: TilePaint): void {
    if (tile.fill) this.setTileFillModifier(tile.hexId, tile.color)
    else this.setTileColorModifier(tile.hexId, tile.color)
  }

  private unpaintTile(tile: TilePaint): void {
    if (tile.fill) this.removeTileFillModifier(tile.hexId, tile.color)
    else this.removeTileColorModifier(tile.hexId, tile.color)
  }

  // Lines render straight from the flattened set, so this just replaces the
  // instance's entry; no per-line diff like paintTiles needs.
  setSkillLines(characterId: number, team: Team, lines: SkillLine[]): void {
    const key = this.getSkillKey(characterId, team)
    if (lines.length) this.skillLines.set(key, lines)
    else this.skillLines.delete(key)
    this.targetVersion++
  }

  clearSkillLines(characterId: number, team: Team): void {
    if (this.skillLines.delete(this.getSkillKey(characterId, team))) this.targetVersion++
  }

  getSkillLines(): SkillLine[] {
    return [...this.skillLines.values()].flat()
  }

  // Get color modifiers mapped by "characterId-team"
  getColorModifiersByCharacterAndTeam(): Map<string, string> {
    const modifiers = new Map<string, string>()

    // Add modifiers from active skills (main characters)
    Object.entries(this.activeSkills).forEach(([key, { characterId }]) => {
      const skill = getCharacterSkill(characterId)
      if (skill?.colorModifier) {
        modifiers.set(key, skill.colorModifier)
      }
    })

    // Add character-specific modifiers (companions)
    Object.entries(this.characterColorModifiers).forEach(([key, color]) => {
      modifiers.set(key, color)
    })

    return modifiers
  }

  // Skill targeting methods
  setSkillTarget(characterId: number, team: Team, target: SkillTargetInfo): void {
    const key = this.getSkillKey(characterId, team)
    this.skillTargets.set(key, target)
    this.targetVersion++ // Trigger reactivity
  }

  getSkillTarget(characterId: number, team: Team): SkillTargetInfo | undefined {
    const key = this.getSkillKey(characterId, team)
    return this.skillTargets.get(key)
  }

  clearSkillTarget(characterId: number, team: Team): void {
    const key = this.getSkillKey(characterId, team)
    this.skillTargets.delete(key)
    this.targetVersion++ // Trigger reactivity
  }

  getAllSkillTargets(): Map<string, SkillTargetInfo> {
    return new Map(this.skillTargets)
  }

  getTargetVersion(): number {
    return this.targetVersion
  }

  // Update all active skills
  updateActiveSkills(grid: Grid): void {
    for (const info of Object.values(this.activeSkills)) {
      const skill = getCharacterSkill(info.characterId)

      const currentHexId = findCharacterHex(grid, info.characterId, info.team)
      if (currentHexId === null) {
        // Character vanished without going through removal, so run full
        // deactivation so modifiers, companions, and team-size changes are
        // cleaned up rather than leaked
        this.deactivateCharacterSkill(info.characterId, info.hexId, info.team, grid)
        continue
      }

      // Update stored position if it changed
      if (info.hexId !== currentHexId) {
        info.hexId = currentHexId
      }

      if (skill?.onUpdate) {
        const context: SkillContext = {
          grid,
          hexId: currentHexId,
          team: info.team,
          characterId: info.characterId,
          skillManager: this,
          lookups: this.lookups,
        }
        skill.onUpdate(context)
      }
    }
  }
}

// Auto-import all skill files to trigger self-registration
// This must be at the bottom after registerSkill is defined
import.meta.glob('./characters/*.ts', { eager: true })
