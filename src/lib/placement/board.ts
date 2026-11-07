import {
  clearCharacterFromTile,
  findCharacterHex,
  getTilesWithCharactersByTeam,
  setCharacterOnTile,
} from '../characters/character'
import { executePlaceCharacter } from '../characters/place'
import { Grid } from '../grid'
import { configTiles, type MapLayout } from '../maps'
import { SkillManager } from '../skills/skill'
import { FULL_GRID } from '../types/grid'
import { State } from '../types/state'
import { Team } from '../types/team'
import type { PlacementLookups, PlacementTeam } from './types'

/**
 * One team on a map layout's ally tiles, placed with Stargazer's own placing. Each
 * unit is placed once, so its skill spawns its companions, and from then on the
 * units are lifted and put down tile to tile, every skill updated after each
 * move, as a board does when a unit is dragged.
 */
export class PlacementBoard {
  readonly grid: Grid
  readonly manager: SkillManager
  // The map's ally deployment tiles, ascending.
  readonly tiles: number[]
  // The team's heroes first, in the team's order, then the phantimal and the
  // companions skills spawned, by id.
  readonly units: number[]
  private at: number[]

  constructor(
    team: PlacementTeam,
    readonly layout: MapLayout,
    readonly lookups: PlacementLookups,
  ) {
    this.grid = new Grid(FULL_GRID, layout.config)
    this.manager = new SkillManager(lookups)
    this.grid.skillManager = this.manager
    this.tiles = [...configTiles(layout.config, Team.ALLY)].sort((a, b) => a - b)

    const mains = team.phantimal === undefined ? team.heroes : [...team.heroes, team.phantimal]
    for (const unit of mains) {
      const free = this.tiles.find(
        (hexId) => this.grid.getTileById(hexId).characterId === undefined,
      )
      if (
        free === undefined ||
        !executePlaceCharacter(this.grid, this.manager, free, unit, Team.ALLY)
      ) {
        throw new Error(`placement: could not place unit ${unit} on ${layout.key}`)
      }
    }
    const spawned = getTilesWithCharactersByTeam(this.grid, Team.ALLY)
      .map((tile) => tile.characterId!)
      .filter((unit) => !team.heroes.includes(unit))
      .sort((a, b) => a - b)
    this.units = [...team.heroes, ...spawned]
    this.at = this.units.map((unit) => findCharacterHex(this.grid, unit, Team.ALLY)!)
    this.manager.updateActiveSkills(this.grid)
  }

  // Each unit's tile, in the order of `units`.
  get positions(): readonly number[] {
    return this.at
  }

  tileOf(unit: number): number {
    return this.at[this.units.indexOf(unit)]!
  }

  // Puts each unit on its tile in `positions` (distinct ally tiles, in the order
  // of `units`). The units that move are all lifted before any is put down, so
  // two can trade tiles.
  place(positions: readonly number[]): void {
    const moving: number[] = []
    for (let i = 0; i < this.units.length; i++) if (positions[i] !== this.at[i]) moving.push(i)
    if (!moving.length) return
    // The same units trade tiles, so the team's size and duplicates cannot
    // change, and only each tile needs checking.
    for (const i of moving) clearCharacterFromTile(this.grid.getTileById(this.at[i]!))
    for (const i of moving) {
      const tile = this.grid.getTileById(positions[i]!)
      if (tile.state !== State.AVAILABLE_ALLY) {
        throw new Error(`placement: could not move unit ${this.units[i]} to ${positions[i]}`)
      }
      setCharacterOnTile(tile, this.units[i]!, Team.ALLY)
    }
    this.at = [...positions]
    this.manager.updateActiveSkills(this.grid)
  }
}
