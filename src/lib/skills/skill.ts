import { findCharacterHex } from '../characters/character'
import { decomposeUnitId } from '../characters/synergy'
import type { Grid } from '../grid'
import type { Team } from '../types/team'
import type { BadgeIcon } from '../types/unitBadge'
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
// SkillManager constructor and every SkillContext.
export interface SkillLookups {
  factionOf: (characterId: number) => string | undefined
  classOf: (characterId: number) => string | undefined
  // Whether a phantimal's skill targeting is switched on in its data file.
  seasonalTargeting: (characterId: number) => boolean
}

// SkillContext defined here (not registry.ts) to avoid circular dep, as it references SkillManager
export interface SkillContext {
  grid: Grid
  hexId: number
  team: Team
  characterId: number
  skillManager: SkillManager
  lookups: SkillLookups
}

// A tile a skill paints. `fill` routes the color to the cell-fill channel (a
// tint blended over the tile background); the default paints the cell border.
export interface TilePaint {
  hexId: number
  color: string
  fill?: boolean
}

// A straight line a skill draws between two hexes: border to border between their
// centers by default, or between two specific hex corners when fromCorner/toCorner are
// set. A corner line on a single hex (fromHexId === toHexId) is an exact tile edge
// (e.g. one segment of a zone outline); across two hexes it is a lane boundary that
// the renderer re-clips to the visible region (a wedge edge).
export interface SkillLine {
  fromHexId: number
  toHexId: number
  color: string
  fromCorner?: number
  toCorner?: number
}

// An icon a skill puts on the unit standing on a hex (drawn by GridCharacters).
export interface SkillBadge {
  hexId: number
  icon: BadgeIcon
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

// A placed unit's skill, and whether it has anything on the board right now.
interface SkillInstance {
  characterId: number
  team: Team
  drawing: boolean
}

// A unit or artifact the Skills dropdown can hide, under its key in the board's
// hidden set. `id` is the unit's base id or the artifact's id.
export interface SkillRow {
  key: string
  team: Team
  kind: 'unit' | 'artifact'
  id: number
  drawing: boolean
}

// A synergy copy shares its base hero's key, so one row covers both.
export const unitSkillKey = (characterId: number, team: Team): string =>
  `${decomposeUnitId(characterId).localId}-${team}`

export const artifactSkillKey = (artifactId: number, team: Team): string =>
  `artifact-${artifactId}-${team}`

const NOTHING_HIDDEN: ReadonlySet<string> = new Set()

// Concrete skill type for character implementations
export type Skill = SkillBase<SkillContext>

// Typed wrappers binding SkillContext to generic registry functions
export function getCharacterSkill(characterId: number): Skill | undefined {
  return _getCharacterSkill<SkillContext>(characterId)
}

export function registerSkill(skill: Skill): void {
  _registerSkill<SkillContext>(skill)
}

function dropTileColor(
  map: Map<number, Map<string, number>>,
  hexId: number,
  color: string,
): boolean {
  const counts = map.get(hexId)
  const count = counts?.get(color)
  if (counts === undefined || count === undefined) return false
  if (count > 1) {
    counts.set(color, count - 1)
  } else {
    counts.delete(color)
    if (counts.size === 0) map.delete(hexId)
  }
  return true
}

export class SkillManager {
  // Track which characters have active skills on which hexes
  // Key is "characterId-team" to allow same character on different teams
  private activeSkills: Record<string, { characterId: number; hexId: number; team: Team }> = {}
  // Track image modifiers for specific characters (for companions)
  // Key is "characterId-team" to support same companion ID on different teams
  private characterImageModifiers: Record<string, string> = {}
  // Two independent tile-paint channels, each keyed by hex id and holding the
  // colors painted there: borders render as the tile stroke, fills as a tinted
  // cell fill. A skill picks one (see TilePaint.fill). Each color carries a
  // refcount so independent skills can paint the same color on one tile. Every
  // paint goes through paintTiles, so skillPaintedTiles can name its painter.
  private tileColorModifiers: Map<number, Map<string, number>> = new Map()
  private tileFillModifiers: Map<number, Map<string, number>> = new Map()
  private skillTargets: Map<string, SkillTargetInfo> = new Map()
  // Tiles each skill instance (characterId-team) has painted, for diff-based cleanup
  private skillPaintedTiles: Map<string, TilePaint[]> = new Map()
  // Connection lines each skill instance draws (rendered by SkillTargeting and SkillCornerLines)
  private skillLines: Map<string, SkillLine[]> = new Map()
  // Unit badges each skill instance shows (rendered by GridCharacters)
  private skillBadges: Map<string, SkillBadge[]> = new Map()
  // Bumped on every mutation the UI must see; the board's computeds read it
  // to re-derive from this non-reactive class.
  private targetVersion = 0

  // Lookups are injected: that data lives in the data store, outside this pure lib.
  constructor(private readonly lookups: SkillLookups) {}

  private getSkillKey(characterId: number, team: Team): string {
    return `${characterId}-${team}`
  }

  hasActiveSkill(characterId: number, team?: Team): boolean {
    if (team !== undefined) {
      return this.getSkillKey(characterId, team) in this.activeSkills
    }
    for (const info of Object.values(this.activeSkills)) {
      if (info.characterId === characterId) return true
    }
    return false
  }

  activateCharacterSkill(characterId: number, hexId: number, team: Team, grid: Grid): boolean {
    const skill = getCharacterSkill(characterId)
    if (!skill) return true // No skill to activate, consider it success

    const skillKey = this.getSkillKey(characterId, team)

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
    this.characterImageModifiers = {}
    this.tileColorModifiers.clear()
    this.tileFillModifiers.clear()
    this.skillTargets.clear()
    this.skillPaintedTiles.clear()
    this.skillLines.clear()
    this.skillBadges.clear()
    this.targetVersion++
  }

  // Add image modifier for a specific character (used by skills for companions)
  addCharacterImageModifier(characterId: number, team: Team, imageName: string): void {
    const key = this.getSkillKey(characterId, team)
    this.characterImageModifiers[key] = imageName
  }

  removeCharacterImageModifier(characterId: number, team: Team): void {
    const key = this.getSkillKey(characterId, team)
    delete this.characterImageModifiers[key]
  }

  // Image modifiers mapped by "characterId-team": active skills' owners, then
  // companions (exposed for UI reactivity)
  getImageModifiersByCharacterAndTeam(): Map<string, string> {
    const modifiers = new Map<string, string>()
    for (const [key, { characterId }] of Object.entries(this.activeSkills)) {
      const imageName = getCharacterSkill(characterId)?.imageModifier
      if (imageName) modifiers.set(key, imageName)
    }
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
    this.targetVersion++
  }

  private removeTileColor(
    map: Map<number, Map<string, number>>,
    hexId: number,
    color: string,
  ): void {
    if (dropTileColor(map, hexId, color)) this.targetVersion++
  }

  private isHidden(key: string, hidden: ReadonlySet<string>): boolean {
    const info = this.activeSkills[key]
    return info !== undefined && hidden.has(unitSkillKey(info.characterId, info.team))
  }

  // A hidden instance's share comes off a copy of the counts, so a color another
  // skill also paints stays and the remaining colors keep their order.
  private visibleColors(
    channel: Map<number, Map<string, number>>,
    fill: boolean,
    hidden: ReadonlySet<string>,
  ): Map<number, string[]> {
    const counts = new Map([...channel].map(([hexId, colors]) => [hexId, new Map(colors)]))
    for (const [key, tiles] of this.skillPaintedTiles) {
      if (!this.isHidden(key, hidden)) continue
      for (const tile of tiles) {
        if (Boolean(tile.fill) === fill) dropTileColor(counts, tile.hexId, tile.color)
      }
    }
    return new Map([...counts].map(([hexId, colors]) => [hexId, [...colors.keys()]]))
  }

  // Border channel
  getTileColorModifier(hexId: number): string[] | undefined {
    const counts = this.tileColorModifiers.get(hexId)
    return counts && counts.size > 0 ? [...counts.keys()] : undefined
  }

  getTileColorModifiers(hidden = NOTHING_HIDDEN): Map<number, string[]> {
    return this.visibleColors(this.tileColorModifiers, false, hidden)
  }

  // Fill channel
  getTileFillModifier(hexId: number): string[] | undefined {
    const counts = this.tileFillModifiers.get(hexId)
    return counts && counts.size > 0 ? [...counts.keys()] : undefined
  }

  getTileFillModifiers(hidden = NOTHING_HIDDEN): Map<number, string[]> {
    return this.visibleColors(this.tileFillModifiers, true, hidden)
  }

  // The last call's tiles come off first, so a repaint can move or recolour
  // the highlight.
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
  private tileChannel(tile: TilePaint): Map<number, Map<string, number>> {
    return tile.fill ? this.tileFillModifiers : this.tileColorModifiers
  }

  private paintTile(tile: TilePaint): void {
    this.addTileColor(this.tileChannel(tile), tile.hexId, tile.color)
  }

  private unpaintTile(tile: TilePaint): void {
    this.removeTileColor(this.tileChannel(tile), tile.hexId, tile.color)
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

  getSkillLines(hidden = NOTHING_HIDDEN): SkillLine[] {
    return [...this.skillLines]
      .filter(([key]) => !this.isHidden(key, hidden))
      .flatMap(([, lines]) => lines)
  }

  setSkillBadges(characterId: number, team: Team, badges: SkillBadge[]): void {
    const key = this.getSkillKey(characterId, team)
    if (badges.length) this.skillBadges.set(key, badges)
    else this.skillBadges.delete(key)
    this.targetVersion++
  }

  clearSkillBadges(characterId: number, team: Team): void {
    if (this.skillBadges.delete(this.getSkillKey(characterId, team))) this.targetVersion++
  }

  // One badge per hex and icon however many instances show it: a synergy
  // copy's party can share members with its base hero's.
  getSkillBadges(hidden = NOTHING_HIDDEN): SkillBadge[] {
    const unique = new Map<string, SkillBadge>()
    for (const [instance, badges] of this.skillBadges) {
      if (this.isHidden(instance, hidden)) continue
      for (const badge of badges) {
        const key = `${badge.hexId}-${badge.icon}`
        if (!unique.has(key)) unique.set(key, badge)
      }
    }
    return [...unique.values()]
  }

  // Skill targeting methods
  setSkillTarget(characterId: number, team: Team, target: SkillTargetInfo): void {
    const key = this.getSkillKey(characterId, team)
    this.skillTargets.set(key, target)
    this.targetVersion++
  }

  getSkillTarget(characterId: number, team: Team): SkillTargetInfo | undefined {
    const key = this.getSkillKey(characterId, team)
    return this.skillTargets.get(key)
  }

  clearSkillTarget(characterId: number, team: Team): void {
    const key = this.getSkillKey(characterId, team)
    this.skillTargets.delete(key)
    this.targetVersion++
  }

  getAllSkillTargets(hidden = NOTHING_HIDDEN): Map<string, SkillTargetInfo> {
    return new Map([...this.skillTargets].filter(([key]) => !this.isHidden(key, hidden)))
  }

  // Arrows count only with an arrow color: a tile highlight stores a target too.
  getSkillInstances(): SkillInstance[] {
    return Object.entries(this.activeSkills).map(([key, { characterId, team }]) => ({
      characterId,
      team,
      drawing:
        !!this.skillPaintedTiles.get(key)?.length ||
        this.skillLines.has(key) ||
        this.skillBadges.has(key) ||
        (!!getCharacterSkill(characterId)?.targetingColorModifier &&
          !!this.skillTargets.get(key)?.metadata?.arrows?.length),
    }))
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
import.meta.glob('./seasonal/*.ts', { eager: true })
