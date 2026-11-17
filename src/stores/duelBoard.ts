/* The Arena page's Honor Duel board: the board on screen read as the state its
 * link holds, a board built from one, the edits that follow the mode's own
 * rules (copies of a hero share a piece of equipment, an off-field spot holds
 * one hero), and a side's faction bonus. */

import { defineStore } from 'pinia'

import {
  canPlaceCharacterOnTile,
  getTilesWithCharacters,
  getTilesWithCharactersByTeam,
  hasCharacter,
  isHeroUnit,
  toBaseHeroId,
} from '@/lib/characters/character'
import { isTrialHeroId, toTrialId, TRIAL_COPIES } from '@/lib/characters/trial'
import { teamFactionBonus, type TeamFactionBonus } from '@/lib/factionBonus'
import { DUEL_ATTR_EQUIPMENT, DUEL_ATTR_SPOT, DUEL_ATTR_TIER } from '@/lib/hd/board'
import {
  decodeDuelBoard,
  encodeDuelBoard,
  type DuelBoardState,
  type DuelUnitState,
} from '@/lib/hd/boardLink'
import { DEFAULT_DUEL_MAP, isDuelMap } from '@/lib/hd/maps'
import { hasCompanionSkill } from '@/lib/skills/registry'
import { packDisplayFlags, type DisplayFlags } from '@/lib/teams/gridStateSerializer'
import { Team } from '@/lib/types/team'
import { useGameDataStore } from './gameData'
import type { GridContext } from './gridContext'
import { useGrids } from './grids'

export const duelHeroUnits = (ctx: GridContext, team: Team): number[] =>
  getTilesWithCharactersByTeam(ctx.grid, team)
    .map((tile) => tile.characterId!)
    .filter(isHeroUnit)

// The board's heroes and artifacts as its link holds them. Companions are left
// out: a hero's skill spawns them again.
function duelBoardState(ctx: GridContext, d: number): DuelBoardState {
  const units = getTilesWithCharacters(ctx.grid)
    .filter((tile) => isHeroUnit(tile.characterId!))
    .map((tile): DuelUnitState => {
      const unitId = tile.characterId!
      const team = tile.team!
      return {
        hexId: tile.hex.getId(),
        team,
        heroId: toBaseHeroId(unitId),
        trial: isTrialHeroId(unitId),
        tier: ctx.getAttr(team, unitId, DUEL_ATTR_TIER),
        equipment: ctx.getAttr(team, unitId, DUEL_ATTR_EQUIPMENT),
        spot: ctx.getAttr(team, unitId, DUEL_ATTR_SPOT),
      }
    })
    .sort((a, b) => a.hexId - b.hexId)
  return {
    d,
    map: ctx.currentMap,
    units,
    artifacts: { ally: ctx.duelArtifacts.ally, enemy: ctx.duelArtifacts.enemy },
  }
}

// Copies of a hero on a side share one piece, so a pick (0 takes the piece
// off) goes to every unit of the hero there.
export function setDuelEquipment(
  ctx: GridContext,
  team: Team,
  unitId: number,
  piece: number,
): void {
  const heroId = toBaseHeroId(unitId)
  for (const id of duelHeroUnits(ctx, team)) {
    if (toBaseHeroId(id) === heroId) ctx.setAttr(team, id, DUEL_ATTR_EQUIPMENT, piece)
  }
}

// A side's off-field spot holds one hero: giving it to another takes it from
// the first. 0 takes the hero off its spot.
export function setDuelSpot(ctx: GridContext, team: Team, unitId: number, spot: number): void {
  const heroes = duelHeroUnits(ctx, team)
  if (!heroes.includes(unitId)) return
  if (spot !== 0) {
    for (const id of heroes) {
      if (id !== unitId && ctx.getAttr(team, id, DUEL_ATTR_SPOT) === spot) {
        ctx.setAttr(team, id, DUEL_ATTR_SPOT, 0)
      }
    }
  }
  ctx.setAttr(team, unitId, DUEL_ATTR_SPOT, spot)
}

// Every hero of the side counts toward its faction, a copy as much as the
// first.
export function duelFactionBonus(ctx: GridContext, team: Team): TeamFactionBonus {
  const gameData = useGameDataStore()
  return teamFactionBonus(
    duelHeroUnits(ctx, team).flatMap(
      (id) => gameData.getCharacterById(toBaseHeroId(id))?.faction ?? [],
    ),
  )
}

export const useDuelBoard = defineStore('duelBoard', () => {
  const grids = useGrids()
  const gameData = useGameDataStore()

  /* Places a state's heroes and artifacts on an empty board standing on the
   * state's map. A hero the board refuses is dropped: one the game data lacks,
   * a tile not open to its side, a sixth hero, a second normal copy. With
   * `relocate` a hero whose tile is gone takes a free one instead, as a map
   * change wants. Trial copy numbers are handed out in tile order. */
  const fill = (ctx: GridContext, state: DuelBoardState, relocate: boolean): void => {
    const units: (DuelUnitState & { unitId: number })[] = []
    let copies = 0
    for (const unit of state.units) {
      if (!gameData.getCharacterById(unit.heroId)) continue
      if (!unit.trial) units.push({ ...unit, unitId: unit.heroId })
      else if (copies < TRIAL_COPIES)
        units.push({ ...unit, unitId: toTrialId(unit.heroId, ++copies) })
    }
    // A summoner's companions spawn on free tiles, so summoners go last, once
    // every other hero holds its tile.
    units.sort((a, b) => Number(hasCompanionSkill(a.unitId)) - Number(hasCompanionSkill(b.unitId)))

    const kept = new Set(units.map((unit) => unit.hexId))
    const spots = new Set<string>()
    for (const { hexId, team, unitId, tier, equipment, spot } of units) {
      // Only a companion can stand on an empty board's tile, and placing over
      // one would take its summoner off with it.
      const own = canPlaceCharacterOnTile(ctx.grid, hexId, team) && !hasCharacter(ctx.grid, hexId)
      const placed = own
        ? ctx.place(hexId, unitId, team)
        : relocate && ctx.autoPlace(unitId, team, kept)
      if (!placed) continue
      const spotKey = `${team}:${spot}`
      ctx.setAttrs(team, unitId, {
        [DUEL_ATTR_TIER]: tier,
        [DUEL_ATTR_EQUIPMENT]: equipment,
        [DUEL_ATTR_SPOT]: spots.has(spotKey) ? 0 : spot,
      })
      spots.add(spotKey)
    }
    ctx.setDuelArtifact(Team.ALLY, state.artifacts.ally)
    ctx.setDuelArtifact(Team.ENEMY, state.artifacts.enemy)
    ctx.refreshSkills()
  }

  /* Puts an Honor Duel board on screen: the one `text` holds, or an empty
   * board on the mode's first map for a text that is no board's. Returns the
   * state read, for its view switches. */
  const open = (text: string | null): DuelBoardState | null => {
    const state = text ? decodeDuelBoard(text) : null
    grids.setGridCount(1, [state?.map ?? DEFAULT_DUEL_MAP], 'honorDuel')
    if (state) fill(grids.active!, state, false)
    return state
  }

  // The Honor Duel board on screen as its link text.
  const snapshot = (flags: DisplayFlags): string =>
    encodeDuelBoard(duelBoardState(grids.active!, packDisplayFlags(flags)))

  // Moves the board onto another of the mode's maps with everything on it.
  const moveToMap = (mapKey: string): boolean => {
    const ctx = grids.active
    if (!ctx || ctx.kind !== 'honorDuel' || !isDuelMap(mapKey)) return false
    const state = duelBoardState(ctx, 0)
    if (!ctx.switchMap(mapKey)) return false
    fill(ctx, { ...state, map: mapKey }, true)
    return true
  }

  return { open, snapshot, moveToMap }
})
