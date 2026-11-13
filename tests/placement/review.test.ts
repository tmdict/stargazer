/* The placement engine's review, run on your own machine against a saved-teams
 * export: PLACEMENT_EXPORT names the export and PLACEMENT_OUT the folder,
 * outside the repository, its report goes to, since an export names players.
 * Each recorded board is rebuilt on Stargazer's grid and its skills, artifacts
 * and charms run as the site runs them. The report says who each effect landed
 * on, and drafts each list the rules name from the teammates players gave the
 * effect to. Left out when PLACEMENT_EXPORT is not set.
 *
 * landings.json beside the report holds each recorded board by `record`, `map`
 * and `arena`, and for its `ally` and `enemy` sides the `heroes`, the
 * `phantimal` and each effect's `landings`: its `owner`, the `holder` it acts
 * from, the units it lands `on` by side, and what it `marked`. The external
 * report generator reads it by these names. */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { isCompanionUnitId } from '@/lib/characters/character'
import { repositionCompanions } from '@/lib/characters/companion'
import {
  inPhantimalBand,
  isPhantimalId,
  toLocalPhantimalId,
  toPhantimalId,
} from '@/lib/characters/phantimal'
import { executePlaceCharacter } from '@/lib/characters/place'
import { toSynergyId } from '@/lib/characters/synergy'
import { getCharmForHero, loadArtifacts, loadCharacters, loadPhantimals } from '@/lib/dataLoader'
import { COMPANION_ID_OFFSET, Grid } from '@/lib/grid'
import { availableState, deploymentTiles, getMapByKey, resolveBoardMap } from '@/lib/maps'
import { PLACEMENT_LOOKUPS } from '@/lib/placement/lookups'
import { artifactReach, ruleUnit, skillReach, tileReach, type Reach } from '@/lib/placement/reach'
import { getCharacterSkill, SkillManager } from '@/lib/skills/skill'
import { decodeTeamData } from '@/lib/teams/codec'
import type { BoardState } from '@/lib/teams/gridStateSerializer'
import { FULL_GRID } from '@/lib/types/grid'
import type { Rule } from '@/lib/types/rule'
import type { CharmData } from '@/lib/types/skill'
import { Team } from '@/lib/types/team'

const EXPORT = process.env.PLACEMENT_EXPORT
const OUT = process.env.PLACEMENT_OUT

const heroes = loadCharacters()
const heroById = new Map(heroes.map((hero) => [hero.id, hero]))
const phantimals = new Map(loadPhantimals().map((phantimal) => [phantimal.id, phantimal]))
const artifacts = new Map(loadArtifacts().map((artifact) => [artifact.id, artifact]))
const charms = new Map<string, CharmData>(
  heroes.flatMap((hero) => {
    const charm = getCharmForHero(hero.name)
    return charm ? [[charm.id, charm] as const] : []
  }),
)

const phantimalOf = (unitId: number) => phantimals.get(toLocalPhantimalId(unitId))

const unitName = (id: number): string => {
  const unit = ruleUnit(id)
  return inPhantimalBand(unit)
    ? (phantimalOf(unit)?.name ?? `phantimal ${id}`)
    : (heroById.get(unit)?.name ?? `hero ${id}`)
}

// The boardRestore restore's order: each main, then its companions onto their
// saved tiles at once, so a spawned companion never squats on a tile a later
// main needs.
function restoreBand(grid: Grid, entries: number[][], toUnitId: (local: number) => number) {
  for (const [hexId, local, team] of entries) {
    if (local! >= COMPANION_ID_OFFSET) continue
    if (!executePlaceCharacter(grid, grid.skillManager!, hexId!, toUnitId(local!), team!)) {
      throw new Error(`could not place unit ${local} on tile ${hexId}`)
    }
    const companions = entries
      .filter(
        ([, id, t]) =>
          id! >= COMPANION_ID_OFFSET && id! % COMPANION_ID_OFFSET === local && t === team,
      )
      .map(([companionHex, id]) => ({ companionId: toUnitId(id!), hexId: companionHex! }))
    repositionCompanions(grid, team!, companions)
  }
}

function rebuild(board: BoardState): Grid {
  const grid = new Grid(FULL_GRID, getMapByKey(resolveBoardMap(board)))
  grid.skillManager = new SkillManager(PLACEMENT_LOOKUPS)
  for (const [hexId, state] of board.t ?? []) {
    grid.setState(grid.getHexById(hexId!), availableState(state!))
  }
  restoreBand(grid, board.c ?? [], (local) => local)
  restoreBand(grid, board.y ?? [], toSynergyId)
  restoreBand(grid, board.s ?? [], toPhantimalId)
  grid.skillManager.updateActiveSkills(grid)
  return grid
}

// What one effect did on one recorded side: the unit that holds it (none for
// an artifact), the units it landed on by team, counting the units on the tiles
// it marks, how many of each team stand on those tiles besides the holder, how
// many factions the holder's team there spans, and how many of its team would
// stand there by chance, its other units spread evenly over its other tiles.
interface Landing {
  owner: string
  holder: string | null
  on: { ally: string[]; enemy: string[] }
  marked: { ally: number; enemy: number; allyFactions: number; allyByChance: number }
}

interface Side {
  heroes: string[]
  phantimal: string | null
  landings: Landing[]
}

function sidesOf(board: BoardState): Side[] {
  const grid = rebuild(board)
  const manager = grid.skillManager!
  const map = resolveBoardMap(board)
  const landing = (
    owner: string,
    holder: { name: string; hexId: number } | null,
    team: Team,
    { landed, marked }: Reach,
  ): Landing => {
    // A unit on two tiles (the twins, a phantimal and its companion) counts once.
    const markedSet = new Set(marked.filter((hexId) => hexId !== holder?.hexId))
    const on = { ally: new Set<string>(), enemy: new Set<string>() }
    for (const hexId of new Set([...landed, ...markedSet])) {
      const tile = grid.getTileById(hexId)
      if (tile.characterId !== undefined) {
        on[tile.team === team ? 'ally' : 'enemy'].add(unitName(tile.characterId))
      }
    }
    const counts = { ally: 0, enemy: 0 }
    const factions = new Set<string | undefined>()
    for (const hexId of markedSet) {
      const tile = grid.getTileById(hexId)
      if (tile.characterId === undefined) continue
      const mine = tile.team === team
      counts[mine ? 'ally' : 'enemy']++
      if (mine) factions.add(PLACEMENT_LOOKUPS.factionOf(tile.characterId))
    }
    const own = [...deploymentTiles(map, team)].filter((hexId) => hexId !== holder?.hexId)
    const units = grid
      .getAllTiles()
      .filter((t) => t.characterId !== undefined && t.team === team).length
    const others = holder ? units - 1 : units
    const allyByChance = own.length
      ? (others * own.filter((hexId) => markedSet.has(hexId)).length) / own.length
      : 0
    return {
      owner,
      holder: holder?.name ?? null,
      on: { ally: [...on.ally], enemy: [...on.enemy] },
      marked: { ...counts, allyFactions: factions.size, allyByChance },
    }
  }

  return [Team.ALLY, Team.ENEMY].map((team) => {
    const side: Side = { heroes: [], phantimal: null, landings: [] }
    const tiles = grid
      .getAllTiles()
      .filter((tile) => tile.characterId !== undefined && tile.team === team)
    for (const tile of tiles) {
      const id = tile.characterId!
      const name = unitName(id)
      const hexId = tile.hex.getId()
      const isHero = !inPhantimalBand(id) && !isCompanionUnitId(id)
      if (isHero) side.heroes.push(name)
      if (isPhantimalId(id)) side.phantimal = name

      if (getCharacterSkill(id)) {
        side.landings.push(landing(name, { name, hexId }, team, skillReach(manager, id, team)))
      }

      const charm = isHero ? getCharmForHero(name) : null
      const ctx = {
        grid,
        hexId,
        team,
        characterId: id,
        skillManager: manager,
        lookups: PLACEMENT_LOOKUPS,
      }
      const tiled = [
        ...PLACEMENT_LOOKUPS.rulesOf(id).map((rule) => [name, rule] as const),
        ...(charm?.rules ?? []).map((rule) => [charm!.id, rule] as const),
      ]
      for (const [owner, rule] of tiled) {
        if (rule.tile)
          side.landings.push(landing(owner, { name, hexId }, team, tileReach(ctx, rule)))
      }
    }
    const artifactId = board.a?.[team === Team.ALLY ? 0 : 1]
    const artifact = artifactId == null ? undefined : artifacts.get(artifactId)
    if (artifact) {
      side.landings.push(
        landing(artifact.name, null, team, artifactReach(grid, team, artifact.name)),
      )
    }
    return side
  })
}

// One choice a player made: the units of `chosen` received the effect, out of
// the units in `from`, the side's heroes and phantimal but the effect's holder.
interface Choice {
  chosen: string[]
  from: string[]
}

// Luce's choice model fitted by Hunter's MM steps, a choice of several broken
// into one choice each against the units that were not chosen. Each unit also
// wins and loses one choice against a reference unit of strength 1, a prior
// that keeps a unit seen once or twice near the middle instead of at an end.
// Returns the units strongest first.
const REFERENCE = ''
function rankByChoices(
  choices: Choice[],
): { unit: string; strength: number; chosen: number; offered: number }[] {
  const names = [...new Set(choices.flatMap((choice) => choice.from))]
  const events = [
    ...choices.flatMap(({ chosen, from }) => {
      const rest = from.filter((unit) => !chosen.includes(unit))
      return chosen.filter((unit) => from.includes(unit)).map((unit) => [unit, ...rest])
    }),
    ...names.flatMap((unit) => [
      [unit, REFERENCE],
      [REFERENCE, unit],
    ]),
  ]
  const wins = new Map(names.map((unit) => [unit, 0]))
  for (const [winner] of events) if (winner !== REFERENCE) wins.set(winner!, wins.get(winner!)! + 1)
  let strength = new Map<string, number>([
    ...names.map((unit) => [unit, 1] as const),
    [REFERENCE, 1],
  ])
  for (let step = 0; step < 500; step++) {
    const denominators = new Map(names.map((unit) => [unit, 0]))
    for (const set of events) {
      const total = set.reduce((sum, unit) => sum + strength.get(unit)!, 0)
      for (const unit of set)
        if (unit !== REFERENCE) denominators.set(unit, denominators.get(unit)! + 1 / total)
    }
    strength = new Map([
      ...names.map((unit) => [unit, wins.get(unit)! / denominators.get(unit)!] as const),
      [REFERENCE, 1] as const,
    ])
  }
  const offered = new Map(names.map((unit) => [unit, 0]))
  for (const { from } of choices) for (const unit of from) offered.set(unit, offered.get(unit)! + 1)
  return names
    .map((unit) => ({
      unit,
      strength: Number(strength.get(unit)!.toPrecision(3)),
      chosen: wins.get(unit)! - 1,
      offered: offered.get(unit)!,
    }))
    .sort((a, b) => b.strength - a.strength || b.offered - a.offered)
}

interface Tally {
  sides: number
  onAlly: Map<string, number>
  onEnemy: Map<string, number>
  teammates: Map<string, number>
  markedAlly: Map<number, number>
  markedEnemy: Map<number, number>
  allyFactions: Map<number, number>
  // Units of the holder's team on the marked tiles, against chance.
  allyMarked: number
  allyByChance: number
  choices: Choice[]
}

const bump = <K>(map: Map<K, number>, key: K) => map.set(key, (map.get(key) ?? 0) + 1)
const sorted = <K>(map: Map<K, number>) => [...map].sort((a, b) => b[1] - a[1])

function rulesOf(name: string): readonly Rule[] {
  return (
    heroes.find((hero) => hero.name === name)?.rules ??
    [...artifacts.values()].find((artifact) => artifact.name === name)?.rules ??
    [...phantimals.values()].find((phantimal) => phantimal.name === name)?.rules ??
    charms.get(name)?.rules ??
    []
  )
}

describe.skipIf(!EXPORT)('placement review', () => {
  it('reports who each effect landed on and drafts the lists', () => {
    if (!OUT) throw new Error('PLACEMENT_OUT names the folder the report goes to')
    const exported = JSON.parse(readFileSync(EXPORT!, 'utf8')) as {
      teams: { name: string; data: string }[]
    }
    const boards = exported.teams.flatMap((record) =>
      (decodeTeamData(record.data)?.boards ?? []).map((board, i) => {
        const [ally, enemy] = sidesOf(board)
        return { record: record.name, map: i + 1, arena: resolveBoardMap(board), ally, enemy }
      }),
    )
    const sides = boards.flatMap(({ ally, enemy }) => [ally!, enemy!])

    const tallies = new Map<string, Tally>()
    const use = new Map<string, number>()
    for (const side of sides) {
      for (const hero of side.heroes) bump(use, hero)
      if (side.phantimal) bump(use, side.phantimal)
      for (const { owner, holder, on, marked } of side.landings) {
        let tally = tallies.get(owner)
        if (!tally) {
          tally = {
            sides: 0,
            onAlly: new Map(),
            onEnemy: new Map(),
            teammates: new Map(),
            markedAlly: new Map(),
            markedEnemy: new Map(),
            allyFactions: new Map(),
            allyMarked: 0,
            allyByChance: 0,
            choices: [],
          }
          tallies.set(owner, tally)
        }
        tally.sides++
        for (const unit of on.ally) bump(tally.onAlly, unit)
        for (const unit of on.enemy) bump(tally.onEnemy, unit)
        const units = side.phantimal ? [...side.heroes, side.phantimal] : side.heroes
        const from = units.filter((unit) => unit !== holder)
        for (const hero of from) bump(tally.teammates, hero)
        bump(tally.markedAlly, marked.ally)
        bump(tally.markedEnemy, marked.enemy)
        bump(tally.allyFactions, marked.allyFactions)
        tally.allyMarked += marked.ally
        tally.allyByChance += marked.allyByChance
        tally.choices.push({ chosen: on.ally, from })
      }
    }

    // Each list an ally rule names, drafted from every effect whose rule names it.
    const pooled = new Map<string, Choice[]>()
    for (const [owner, tally] of tallies) {
      for (const { team, goal } of rulesOf(owner)) {
        if (team !== 'ally' || typeof goal !== 'object') continue
        const list = 'target' in goal ? goal.target : 'include' in goal ? goal.include : undefined
        if (list !== undefined) pooled.set(list, [...(pooled.get(list) ?? []), ...tally.choices])
      }
    }

    const report = {
      boards: sides.length / 2,
      use: sorted(use),
      effects: [...tallies]
        .sort((a, b) => b[1].sides - a[1].sides)
        .map(([owner, tally]) => ({
          owner,
          rules: rulesOf(owner),
          sides: tally.sides,
          onAlly: sorted(tally.onAlly).map(([unit, n]) => [
            unit,
            n,
            tally.teammates.get(unit) ?? 0,
          ]),
          onEnemy: sorted(tally.onEnemy),
          markedAlly: [...tally.markedAlly].sort((a, b) => a[0] - b[0]),
          markedEnemy: [...tally.markedEnemy].sort((a, b) => a[0] - b[0]),
          allyFactions: [...tally.allyFactions].sort((a, b) => a[0] - b[0]),
          allyMarked: tally.allyMarked,
          allyByChance: Number(tally.allyByChance.toFixed(1)),
          order: rankByChoices(tally.choices),
        })),
      lists: Object.fromEntries(
        [...pooled].map(([list, choices]) => [list, rankByChoices(choices)]),
      ),
    }
    expect(sides.length, 'boards read from the export').toBeGreaterThan(0)
    mkdirSync(OUT, { recursive: true })
    writeFileSync(join(OUT, 'review.json'), `${JSON.stringify(report, null, 1)}\n`)
    writeFileSync(join(OUT, 'landings.json'), `${JSON.stringify(boards)}\n`)
  })
})
