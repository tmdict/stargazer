import { findCharacterHex } from '../characters/character'
import type { Grid } from '../grid'
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

// A straight line a skill draws between two hexes: border to border between their
// centers by default, or between two specific hex corners (an exact edge line, e.g. a
// wedge boundary) when fromCorner/toCorner are set.
export interface SkillLine {
  fromHexId: number
  toHexId: number
  color: string
  fromCorner?: number
  toCorner?: number
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
  // cell fill. A skill picks one (see TilePaint.fill). Each color carries a
  // refcount so independent skills can paint the same color on one tile.
  private tileColorModifiers: Map<number, Map<string, number>> = new Map()
  private tileFillModifiers: Map<number, Map<string, number>> = new Map()
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

    this.activeSkills[skillKey] = { characterId, hexId, team }

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

    delete this.activeSkills[skillKey]

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
    this.skillTargets.clear()
    this.skillPaintedTiles.clear()
    this.skillLines.clear()
    this.targetVersion++ // Trigger reactivity to clear UI
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
  // A color is refcounted per tile so one skill's cleanup never deletes a color
  // another skill still paints (e.g. a target highlight sharing a zone outline's
  // color); it disappears only when its last painter removes it.
  private addTileColor(map: Map<number, Map<string, number>>, hexId: number, color: string): void {
    const counts = map.get(hexId) ?? new Map<string, number>()
    counts.set(color, (counts.get(color) ?? 0) + 1)
    map.set(hexId, counts)
    this.targetVersion++ // Trigger reactivity
  }

  private removeTileColor(
    map: Map<number, Map<string, number>>,
    hexId: number,
    color: string,
  ): void {
    const counts = map.get(hexId)
    const count = counts?.get(color)
    if (counts === undefined || count === undefined) return
    if (count > 1) {
      counts.set(color, count - 1)
    } else {
      counts.delete(color)
      if (counts.size === 0) map.delete(hexId)
    }
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
    const counts = this.tileColorModifiers.get(hexId)
    return counts && counts.size > 0 ? [...counts.keys()] : undefined
  }

  getTileColorModifiers(): Map<number, string[]> {
    return new Map(
      [...this.tileColorModifiers].map(([hexId, counts]) => [hexId, [...counts.keys()]]),
    )
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
    const counts = this.tileFillModifiers.get(hexId)
    return counts && counts.size > 0 ? [...counts.keys()] : undefined
  }

  getTileFillModifiers(): Map<number, string[]> {
    return new Map(
      [...this.tileFillModifiers].map(([hexId, counts]) => [hexId, [...counts.keys()]]),
    )
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

  // Update all active skills. Each skill is isolated: one throwing onUpdate (or
  // vanish-cleanup) must not abort the sweep and leave the remaining skills stale.
  updateActiveSkills(grid: Grid): void {
    for (const info of Object.values(this.activeSkills)) {
      try {
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
      } catch (error) {
        console.error('Skill update failed:', error)
      }
    }
  }
}

// Auto-import all skill files to trigger self-registration
// This must be at the bottom after registerSkill is defined
import.meta.glob('./characters/*.ts', { eager: true })
