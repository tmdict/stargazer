/* The Arena page's Honor Duel board: the board on screen read as the state its
 * link holds, a board built from one, the edits that follow the mode's own
 * rules (copies of a hero share a piece of equipment, a hero changes between
 * its normal and its Trial copy, and a list's click places or removes an
 * artifact), and a side's faction bonus. */

import { defineStore } from 'pinia'

import {
  canPlaceCharacterOnTile,
  findCharacterHex,
  getAllAvailableTilesForTeam,
  getTilesWithCharacters,
  getTilesWithCharactersByTeam,
  hasCharacter,
  isCharacterOnTeam,
  isHeroUnit,
  toBaseHeroId,
} from '@/lib/characters/character'
import { getCompanions, repositionCompanions } from '@/lib/characters/companion'
import { freeTrialCopy, isTrialHeroId, toTrialId, TRIAL_COPIES } from '@/lib/characters/trial'
import { teamFactionBonus, type TeamFactionBonus } from '@/lib/factionBonus'
import { DUEL_ATTR_EQUIPMENT, DUEL_ATTR_TIER } from '@/lib/hd/board'
import {
  decodeDuelBoard,
  encodeDuelBoard,
  type DuelBoardState,
  type DuelUnitState,
} from '@/lib/hd/boardLink'
import { DEFAULT_DUEL_MAP, isDuelMap } from '@/lib/hd/maps'
import { duelSourceTiers, duelTiersOf } from '@/lib/hd/units'
import { hasCompanionSkill } from '@/lib/skills/registry'
import { packDisplayFlags, type DisplayFlags } from '@/lib/teams/gridStateSerializer'
import { Team } from '@/lib/types/team'
import { useGameDataStore } from './gameData'
import type { GridContext } from './gridContext'
import { artifactSlot, useGrids } from './grids'

const duelHeroUnits = (ctx: GridContext, team: Team): number[] =>
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

/* The id a hero on the board would hold as its other copy: a Trial copy of a
 * normal hero under the board's lowest free copy number, or the normal copy of
 * a Trial one. Null where there is none: a unit only one source brings, and a
 * Trial copy whose side holds the hero's normal copy, since a side takes one. */
export function duelOtherCopy(ctx: GridContext, team: Team, unitId: number): number | null {
  const heroId = toBaseHeroId(unitId)
  let other = heroId
  if (isTrialHeroId(unitId)) {
    if (isCharacterOnTeam(ctx.grid, heroId, team)) return null
  } else {
    const copy = freeTrialCopy(getTilesWithCharacters(ctx.grid).map((tile) => tile.characterId!))
    if (copy === null) return null
    other = toTrialId(heroId, copy)
  }
  return duelTiersOf(other).length > 0 ? other : null
}

/* Changes a hero on the board between its normal and its Trial copy, and
 * returns the copy's id, or null when nothing changed. The copy is a unit with
 * an id of its own, placed over the first: it takes the tile, and the tier and
 * equipment are handed to it, the tier moved to the nearest its source allows. */
export function swapDuelCopy(ctx: GridContext, team: Team, unitId: number): number | null {
  const hexId = findCharacterHex(ctx.grid, unitId, team)
  const other = duelOtherCopy(ctx, team, unitId)
  if (hexId === null || other === null) return null
  const values = ctx.getAttrs(team, unitId)
  if (!ctx.place(hexId, other, team)) return null
  ctx.setAttrs(team, other, values)
  return other
}

// The side that holds the artifact, the first of `sides` when more than one does.
export const duelArtifactSide = (
  ctx: GridContext,
  id: number,
  sides: readonly Team[],
): Team | null => sides.find((team) => artifactSlot(ctx.duelArtifacts, team)?.id === id) ?? null

/* A list's click on an artifact, by the Arena list's rule: one a side holds
 * comes off it, and any other goes at level 1 to the first of `sides` whose
 * place shows none. With an artifact on every side the click changes nothing.
 * A place shows none for an id that names no artifact, and `names` tells
 * which do: the catalog that knows stays out of this file. */
export function toggleDuelArtifact(
  ctx: GridContext,
  id: number,
  sides: readonly Team[],
  names: (id: number) => boolean,
): void {
  const held = duelArtifactSide(ctx, id, sides)
  if (held !== null) {
    ctx.setDuelArtifact(held, null)
    return
  }
  const free = sides.find((team) => {
    const slot = artifactSlot(ctx.duelArtifacts, team)
    return slot === null || !names(slot.id)
  })
  if (free !== undefined) ctx.setDuelArtifact(free, { id, level: 1 })
}

// Every unit of the side counts toward its faction, a copy as much as the
// first, and a creature toward the creatures' own.
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

  /* Places a state's units and artifacts on an empty board standing on the
   * state's map. A unit the board refuses is dropped: one the game data lacks,
   * one its source does not bring (a hero the shop does not sell, a unit no
   * Trial Card shows, a creature without the Trial mark), a tile not open to
   * its side, a sixth unit, a second normal copy. A tier the unit's source does
   * not allow moves to the nearest it does, as the board's value rules clamp
   * it. With `relocate` a unit whose tile is gone takes a free one instead, as
   * a map change wants. Trial copy numbers are handed out in tile order. */
  const fill = (ctx: GridContext, state: DuelBoardState, relocate: boolean): void => {
    const units: (DuelUnitState & { unitId: number })[] = []
    let copies = 0
    for (const unit of state.units) {
      const name = gameData.getCharacterById(unit.heroId)?.name
      if (name === undefined || duelSourceTiers(name, unit.trial).length === 0) continue
      if (!unit.trial) units.push({ ...unit, unitId: unit.heroId })
      else if (copies < TRIAL_COPIES)
        units.push({ ...unit, unitId: toTrialId(unit.heroId, ++copies) })
    }
    // A summoner's companions spawn on free tiles, so summoners go last, once
    // every other hero holds its tile.
    units.sort((a, b) => Number(hasCompanionSkill(a.unitId)) - Number(hasCompanionSkill(b.unitId)))

    const kept = new Set(units.map((unit) => unit.hexId))
    // The free tiles a companion spawns on include those of summoners still to
    // come, so one that lands there steps aside onto a tile the state leaves
    // free.
    const settleCompanions = (team: Team, unitId: number): void => {
      const stray = [...getCompanions(ctx.grid, unitId, team)].filter((companionId) => {
        const at = findCharacterHex(ctx.grid, companionId, team)
        return at !== null && kept.has(at)
      })
      if (stray.length === 0) return
      const spare = getAllAvailableTilesForTeam(ctx.grid, team)
        .map((tile) => tile.hex.getId())
        .filter((hexId) => !kept.has(hexId))
      const moves = stray.flatMap((companionId) => {
        const [hexId] = spare.splice(Math.floor(Math.random() * spare.length), 1)
        return hexId === undefined ? [] : [{ companionId, hexId }]
      })
      if (moves.length > 0) repositionCompanions(ctx.grid, team, moves)
    }
    for (const { hexId, team, unitId, tier, equipment } of units) {
      // Only a companion can stand on an empty board's tile, and placing over
      // one would take its summoner off with it.
      const own = canPlaceCharacterOnTile(ctx.grid, hexId, team) && !hasCharacter(ctx.grid, hexId)
      const placed = own
        ? ctx.place(hexId, unitId, team)
        : relocate && ctx.autoPlace(unitId, team, kept)
      if (!placed) continue
      settleCompanions(team, unitId)
      ctx.setAttrs(team, unitId, {
        [DUEL_ATTR_TIER]: tier,
        [DUEL_ATTR_EQUIPMENT]: equipment,
      })
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
