/* The placement engine measured against recorded formations, run on your own
 * machine. PLACEMENT_EXPORT names one or more saved-teams exports, joined as a
 * PATH is, and PLACEMENT_OUT the folder, outside the repository, its measures
 * and review page go to, since an export names players. What the engine is
 * tuned with comes from the Supreme League data file, read with the
 * VITE_SL_SEED setting. Each Supreme League set-up is placed by the engine and set beside
 * the player's own. A season other than the one Stargazer holds phantimals for
 * is placed without its phantimal and seasonal artifact, and scores no buff
 * tile, since the map files hold this season's, and how often each enemy hero
 * is on a map is counted from its boards. PLACEMENT_FULL is how many of
 * the most used teams are also placed by trying every placement, to check the
 * search. PLACEMENT_TUNE names weights, joined by commas, for which the run
 * suggests a value from the players' formations. Left out when
 * PLACEMENT_EXPORT is not set. */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { delimiter, join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { isCompanionUnitId, toBaseHeroId } from '@/lib/characters/character'
import { inPhantimalBand, isPhantimalId, toPhantimalId } from '@/lib/characters/phantimal'
import { COMPANION_ID_OFFSET, Grid, rotatedHexId } from '@/lib/grid'
import { Layout, POINTY } from '@/lib/layout'
import { buffTiles, deploymentTiles, getMapByKey, resolveBoardMap } from '@/lib/maps'
import { PlacementBoard } from '@/lib/placement/board'
import { placeTeam, type PlacementResult } from '@/lib/placement/engine'
import { artifactById, heroById, phantimalOf, PLACEMENT_LOOKUPS } from '@/lib/placement/lookups'
import {
  PlacementScorer,
  type FormationCheck,
  type GoalCheck,
  type PlacementScore,
} from '@/lib/placement/score'
import type { FormationRule, PlacementData, PlacementTeam } from '@/lib/placement/types'
import { decodeSlData } from '@/lib/pvp/sl/data/codec'
import { FULL_GRID } from '@/lib/types/grid'
import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'
import {
  loadArtifactLocales,
  loadCharacterLocales,
  loadPhantimalLocales,
  loadPhantimals,
} from '@/utils/dataLoader'
import { decodeMultiGridStateFromUrl } from '@/utils/urlStateManager'

const EXPORTS = process.env.PLACEMENT_EXPORT?.split(delimiter).filter(Boolean) ?? []
const OUT = process.env.PLACEMENT_OUT
const FULL = Number(process.env.PLACEMENT_FULL ?? 0)
// The review page shows this many of the live season's most used teams.
const REVIEWED = 30
// Full search is tried only where it takes a few seconds.
const FULL_LIMIT = 700_000
const TUNE = process.env.PLACEMENT_TUNE?.split(',').filter(Boolean) ?? []
const TUNE_SHARES = [0, 0.1, 0.25, 0.5, 1]

const LIVE = Math.max(...loadPhantimals().map((phantimal) => phantimal.season))

const heroLocales = loadCharacterLocales()
const phantimalLocales = loadPhantimalLocales()
const artifactLocales = loadArtifactLocales()
function nameOf(owner: number | string): string {
  if (typeof owner === 'string') return artifactLocales[owner]?.en ?? owner
  if (inPhantimalBand(owner)) {
    const slug = phantimalOf(owner)?.name ?? ''
    return phantimalLocales[slug]?.en ?? slug
  }
  const slug = heroById.get(toBaseHeroId(owner))?.name ?? `${owner}`
  return heroLocales[slug]?.en ?? slug
}

// One player's set-up on one map: the team and the tile each unit stood on,
// seen from the ally side.
interface Setup {
  season: number
  live: boolean
  map: string
  team: PlacementTeam
  tiles: Map<number, number>
}

// "S8 SL1 Group - A > B (1,2,3 > 4,5)": the season, then the two players, the
// first on the ally side.
const RECORD_NAME = /^S(\d+) SL\d+\b.*?\s-\s(.+?)\s*[<>]\s*(.+?)\s*\(/
const FULL_BOARD = new Grid()

function sideOf(
  board: NonNullable<ReturnType<typeof decodeMultiGridStateFromUrl>>['boards'][number],
  team: Team,
  map: string,
  live: boolean,
): Omit<Setup, 'season' | 'live' | 'map'> | null {
  const ally = deploymentTiles(map, Team.ALLY)
  const toAlly = (hexId: number) => (team === Team.ALLY ? hexId : rotatedHexId(FULL_BOARD, hexId))
  const tiles = new Map<number, number>()
  const add = (unit: number, hexId: number) => {
    const tile = toAlly(hexId)
    if (tile === undefined || !ally.has(tile)) return false
    tiles.set(unit, tile)
    return true
  }
  if ((board.y ?? []).some(([, , t]) => t === team)) return null
  const ids: number[] = []
  for (const [hexId, id, t] of board.c ?? []) {
    if (t !== team) continue
    if (!add(id!, hexId!)) return null
    if (id! < COMPANION_ID_OFFSET) ids.push(id!)
  }
  if (ids.length !== 5) return null
  let phantimal: number | undefined
  for (const [hexId, local, t] of live ? (board.s ?? []) : []) {
    if (t !== team) continue
    const unit = toPhantimalId(local!)
    if (!add(unit, hexId!)) return null
    if (isPhantimalId(unit)) phantimal = unit
  }
  const artifactId = board.a?.[team - 1] ?? undefined
  const artifact =
    artifactId != null && (live || artifactById.get(artifactId)?.season === 0)
      ? artifactId
      : undefined
  return { team: { heroes: ids.sort((a, b) => a - b), phantimal, artifact }, tiles }
}

// For each season, each map's board sides and how many hold each hero with a
// rule against us, every recorded game counted.
const sidesSeen = new Map<number, Map<string, number>>()
const picksSeen = new Map<number, Map<string, Map<number, number>>>()

function countPicks(
  season: number,
  map: string,
  board: NonNullable<ReturnType<typeof decodeMultiGridStateFromUrl>>['boards'][number],
) {
  const sides = sidesSeen.get(season) ?? new Map<string, number>()
  sides.set(map, (sides.get(map) ?? 0) + 2)
  sidesSeen.set(season, sides)
  const picks = picksSeen.get(season) ?? new Map<string, Map<number, number>>()
  const onMap = picks.get(map) ?? new Map<number, number>()
  for (const [, id] of board.c ?? []) {
    if (
      id! >= COMPANION_ID_OFFSET ||
      !PLACEMENT_LOOKUPS.rulesOf(id!).some((rule) => rule.team === 'enemy')
    ) {
      continue
    }
    onMap.set(id!, (onMap.get(id!) ?? 0) + 1)
  }
  picks.set(map, onMap)
  picksSeen.set(season, picks)
}

// A season's pick rates as the engine's data holds them.
const pickRatesOf = (season: number): PlacementData['pickRates'] =>
  Object.fromEntries(
    [...(picksSeen.get(season) ?? [])].map(([map, onMap]) => [
      map,
      Object.fromEntries([...onMap].map(([id, n]) => [id, n / sidesSeen.get(season)!.get(map)!])),
    ]),
  )

function setupsOf(file: string): Setup[] {
  const exported = JSON.parse(readFileSync(file, 'utf8')) as {
    teams: { name: string; data: string }[]
  }
  const found = new Map<string, Setup>()
  for (const record of exported.teams) {
    const name = RECORD_NAME.exec(record.name.replace(/\s*\(copy\)+\s*$/i, ''))
    if (!name) continue
    const season = Number(name[1])
    const live = season === LIVE
    const players = [name[2]!.toLowerCase(), name[3]!.toLowerCase()]
    for (const board of decodeMultiGridStateFromUrl(record.data)?.boards ?? []) {
      const map = resolveBoardMap(board)
      if (!getMapByKey(map)) continue
      countPicks(season, map, board)
      for (const team of [Team.ALLY, Team.ENEMY]) {
        const side = sideOf(board, team, map, live)
        if (!side) continue
        // A locked stage repeats a set-up, which counts once.
        const placed = [...side.tiles].sort(([a], [b]) => a - b).map(([u, t]) => `${u}@${t}`)
        const key = `${players[team - 1]}|${map}|${placed.join(',')}`
        if (!found.has(key)) found.set(key, { season, live, map, ...side })
      }
    }
  }
  return [...found.values()]
}

const teamKey = ({ team, map, live }: Pick<Setup, 'team' | 'map' | 'live'>) =>
  `${map}|${team.heroes.join(',')}|${team.phantimal ?? ''}|${team.artifact ?? ''}|${live}`

interface Scored {
  positions: number[]
  score: PlacementScore
  threats: number
  goals: GoalCheck[]
  formation: FormationCheck[]
}

function scoreSetup(setup: Setup, data: PlacementData): Scored | null {
  const board = new PlacementBoard(setup.team, setup.map, PLACEMENT_LOOKUPS)
  if (board.units.length !== setup.tiles.size || board.units.some((u) => !setup.tiles.has(u))) {
    return null
  }
  const scorer = new PlacementScorer(board, setup.team, data, { buffTiles: setup.live })
  const positions = board.units.map((unit) => setup.tiles.get(unit)!)
  board.place(positions)
  return {
    positions,
    score: scorer.score(),
    threats: scorer.threats(),
    goals: scorer.goals(),
    formation: scorer.formation(),
  }
}

// Four bands by distance to the nearest enemy tile, over the map's ally tiles.
const bandsSeen = new Map<string, Map<number, number>>()
function bandsOf(map: string): Map<number, number> {
  const seen = bandsSeen.get(map)
  if (seen) return seen
  const grid = new Grid(FULL_GRID, getMapByKey(map)!)
  const enemy = [...deploymentTiles(map, Team.ENEMY)].map((id) => grid.getHexById(id))
  const near = new Map(
    [...deploymentTiles(map, Team.ALLY)].map((id) => {
      const hex = grid.getHexById(id)
      return [id, Math.min(...enemy.map((other) => hex.distance(other)))]
    }),
  )
  const lo = Math.min(...near.values())
  const hi = Math.max(...near.values())
  const bands = new Map(
    [...near].map(([id, d]) => [id, Math.min(3, Math.floor((4 * (d - lo)) / (hi - lo + 1e-9)))]),
  )
  bandsSeen.set(map, bands)
  return bands
}

const RELATION_TEXT: Record<FormationRule['relation'], (names: string[]) => string> = {
  frontmost: ([a]) => `${a} frontmost`,
  twoFrontmost: ([a]) => `${a} in the two frontmost`,
  rearmost: ([a]) => `${a} rearmost`,
  twoRearmost: ([a]) => `${a} in the two rearmost`,
  inFrontOf: ([a, b]) => `${a} in front of ${b}`,
  nextTo: ([a, b]) => `${a} next to ${b}`,
  behind: ([a, b]) => `${b} directly behind ${a}`,
  nearestOnRow: ([a, b]) => `${b} nearest on ${a}'s row`,
  mutualNearestOnRow: ([a, b]) => `${a} and ${b} nearest on each other's row`,
}
const ruleText = (rule: FormationRule) =>
  `${RELATION_TEXT[rule.relation](rule.heroes.map(nameOf))} (${rule.holds})`
const goalKey = (goal: GoalCheck) => `${nameOf(goal.owner)}: ${goal.rule.note}`

const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(0)}%` : '-')
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted.length ? sorted[Math.floor(sorted.length / 2)]! : 0
}
const permutations = (tiles: number, units: number) => {
  let count = 1
  for (let i = 0; i < units; i++) count *= tiles - i
  return count
}

interface Tally {
  sum: number
  n: number
}
const add = (map: Map<string, Tally>, key: string, value: number) => {
  const tally = map.get(key) ?? { sum: 0, n: 0 }
  tally.sum += value
  tally.n++
  map.set(key, tally)
}

const LEGEND = `<ul class="legend">${[
  ['ally', 'our tiles'],
  ['enemy', 'enemy tiles'],
  ['wall', 'wall'],
  ['ally buff', 'buff tile'],
  ['ally held', 'a unit'],
]
  .map(
    ([kind, text]) =>
      `<li><svg viewBox="0 0 12 12"><rect x="1" y="1" width="10" height="10" class="${kind}"/></svg>${text}</li>`,
  )
  .join('')}<li><i>italic</i> a phantimal or companion</li></ul>`

const esc = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// A small drawing of one map with each unit's name on its tile.
function boardSvg(map: string, units: number[], positions: number[]): string {
  const grid = new Grid(FULL_GRID, getMapByKey(map)!)
  const layout = new Layout(POINTY, { x: 17, y: 17 }, { x: 0, y: 0 })
  const tiles = grid.getAllTiles()
  const centers = tiles.map((tile) => layout.hexToPixel(tile.hex))
  const xs = centers.map((p) => p.x)
  const ys = centers.map((p) => p.y)
  const [x0, y0] = [Math.min(...xs) - 18, Math.min(...ys) - 18]
  const [w, h] = [Math.max(...xs) - x0 + 18, Math.max(...ys) - y0 + 18]
  const at = new Map(positions.map((hexId, i) => [hexId, units[i]!]))
  const buffs = new Set(buffTiles(map))
  const cells = tiles.map((tile, i) => {
    const { x, y } = centers[i]!
    const corners = Array.from({ length: 6 }, (_, c) => {
      const o = layout.hexCornerOffset(c)
      return `${(x + o.x * 0.95).toFixed(1)},${(y + o.y * 0.95).toFixed(1)}`
    }).join(' ')
    const kind =
      tile.state === State.AVAILABLE_ALLY
        ? 'ally'
        : tile.state === State.AVAILABLE_ENEMY
          ? 'enemy'
          : tile.state === State.BLOCKED || tile.state === State.BLOCKED_BREAKABLE
            ? 'wall'
            : 'open'
    const id = tile.hex.getId()
    const unit = at.get(id)
    const label =
      unit === undefined
        ? ''
        : `<text x="${x.toFixed(1)}" y="${(y + 3).toFixed(1)}" class="${isCompanionUnitId(unit) || inPhantimalBand(unit) ? 'pt' : 'ht'}"><title>${esc(nameOf(unit))}</title>${esc(nameOf(unit).slice(0, 7))}</text>`
    return `<polygon points="${corners}" class="${kind}${buffs.has(id) ? ' buff' : ''}${unit === undefined ? '' : ' held'}"/>${label}`
  })
  return `<svg viewBox="${x0.toFixed(0)} ${y0.toFixed(0)} ${w.toFixed(0)} ${h.toFixed(0)}" role="img">${cells.join('')}</svg>${LEGEND}`
}

function goalList(goals: GoalCheck[], formation: FormationCheck[]): string {
  const rows = [
    ...goals.map(
      (goal) =>
        `<li class="${goal.met === null ? 'na' : goal.met >= 1 ? 'met' : goal.met > 0 ? 'part' : 'miss'}">${esc(goalKey(goal))} <b>${goal.met === null ? 'n/a' : `${Math.round(goal.met * 100)}%`}</b></li>`,
    ),
    ...formation.map(
      ({ rule, held }) =>
        `<li class="${held ? 'met' : 'miss'}">${esc(ruleText(rule))} <b>${held ? 'holds' : 'breaks'}</b></li>`,
    ),
  ]
  return rows.length ? `<ul>${rows.join('')}</ul>` : '<p class="na">No goal or rule applies.</p>'
}

const scoreLine = (score: PlacementScore) =>
  `goals ${score.goals.toFixed(1)}, total ${score.total.toFixed(2)}${score.broken ? `, ${score.broken} always rule broken` : ''}`

describe.skipIf(!EXPORTS.length)('placement engine', () => {
  it('places every recorded set-up and measures it against the player', async () => {
    if (!OUT) throw new Error('PLACEMENT_OUT names the folder the measures go to')
    const liveData = (
      await decodeSlData(readFileSync(new URL('../../src/content/pvp/sl/sl.bin', import.meta.url)))
    ).placement
    const margin = liveData.weights.margin ?? 0
    const setups = EXPORTS.flatMap(setupsOf)
    expect(setups.length, 'set-ups read from the exports').toBeGreaterThan(0)
    // The live season's pick rates come with the data, another season's from its
    // own boards.
    const seasonData = new Map(
      [...new Set(setups.map((setup) => setup.season))].map((season) => [
        season,
        season === LIVE ? liveData : { ...liveData, pickRates: pickRatesOf(season) },
      ]),
    )
    const dataOf = (setup: Setup) => seasonData.get(setup.season)!

    const results = new Map<string, { result: PlacementResult; ms: number }>()
    const engineOf = (setup: Setup) => {
      const key = teamKey(setup)
      let entry = results.get(key)
      if (!entry) {
        const start = performance.now()
        const result = placeTeam(setup.team, setup.map, dataOf(setup), PLACEMENT_LOOKUPS, {
          buffTiles: setup.live,
        })
        entry = { result, ms: performance.now() - start }
        results.set(key, entry)
      }
      return entry
    }

    const lines: string[] = []
    const log = (line = '') => lines.push(line)
    const skipped = new Set<string>()
    const placed: { setup: Setup; player: Scored }[] = []

    for (const season of [...new Set(setups.map((s) => s.season))].sort((a, b) => b - a)) {
      const ofSeason = setups.filter((setup) => setup.season === season)
      const goals = { players: new Map<string, Tally>(), engine: new Map<string, Tally>() }
      const formation = { players: new Map<string, Tally>(), engine: new Map<string, Tally>() }
      let heroes = 0
      let onTile = 0
      let inBand = 0
      let inKept = 0
      let scored = 0
      let amongEqual = 0
      let playerAhead = 0
      const threats = { players: 0, engine: 0 }
      const teams = new Set<string>()
      const missed: string[] = []

      for (const setup of ofSeason) {
        let player: Scored | null
        try {
          player = scoreSetup(setup, dataOf(setup))
        } catch {
          player = null
        }
        if (!player) continue
        const { result } = engineOf(setup)
        teams.add(teamKey(setup))
        for (const { owner, reason } of result.skipped) skipped.add(`${nameOf(owner)}: ${reason}`)
        scored++
        placed.push({ setup, player })
        threats.players += player.threats
        threats.engine += result.threats

        for (const goal of player.goals)
          if (goal.met !== null) add(goals.players, goalKey(goal), goal.met)
        for (const goal of result.goals)
          if (goal.met !== null) add(goals.engine, goalKey(goal), goal.met)
        for (const check of player.formation)
          add(formation.players, ruleText(check.rule), +check.held)
        for (const check of result.formation)
          add(formation.engine, ruleText(check.rule), +check.held)

        const band = bandsOf(setup.map)
        setup.team.heroes.forEach((hero, i) => {
          const mine = setup.tiles.get(hero)!
          const engine = result.positions[result.units.indexOf(hero)]!
          heroes++
          if (mine === engine) onTile++
          if (band.get(mine) === band.get(engine)) inBand++
          if (result.kept[i]!.includes(mine)) inKept++
        })
        const best = result.best
        if (
          player.score.broken < best.broken ||
          (player.score.broken === best.broken && player.score.goals > best.goals + 1e-9)
        ) {
          playerAhead++
          missed.push(
            `${setup.team.heroes.map(nameOf).join(', ')} on ${setup.map}: the player ${scoreLine(player.score)}, the engine's best ${scoreLine(best)}`,
          )
        }
        if (
          player.score.broken === best.broken &&
          player.score.goals >= best.goals - margin - 1e-9
        ) {
          amongEqual++
        }
      }

      const teamResults = [...teams].map((key) => results.get(key)!)
      const equal = teamResults.map(({ result }) => result.equallyGood)
      const keptTiles = teamResults.flatMap(({ result }) =>
        result.kept.map((tiles) => tiles.length),
      )
      log(`Season ${season}: ${ofSeason.length} set-ups, ${scored} placed, ${teams.size} teams`)
      log(
        `  heroes on the player's tile ${pct(onTile, heroes)}, in the player's band ${pct(inBand, heroes)} (yardsticks: about 25% and 50% learned from another season, 61% for two players with the same team, 70% copying)`,
      )
      log(`  player's tile among those the hero keeps ${pct(inKept, heroes)}`)
      log(
        `  points for the enemy rules a formation blunts, per set-up: players ${(threats.players / scored).toFixed(2)}, the engine ${(threats.engine / scored).toFixed(2)}`,
      )
      log(
        `  player's formation among the engine's equally good ${pct(amongEqual, scored)}, scoring above the engine's best ${pct(playerAhead, scored)}`,
      )
      for (const line of missed.slice(0, 5)) log(`    ${line}`)
      log(
        `  equally good placements per team: median ${median(equal)}, at the cap of the count ${pct(teamResults.filter(({ result }) => !result.complete).length, teamResults.length)}`,
      )
      log(`  tiles each hero keeps: median ${median(keptTiles)}`)
      log(
        `  time per team: median ${median(teamResults.map(({ ms }) => ms)).toFixed(0)} ms, longest ${Math.max(...teamResults.map(({ ms }) => ms)).toFixed(0)} ms, placements scored median ${median(teamResults.map(({ result }) => result.evaluations))}`,
      )
      log('  goals, how much of each players and the engine meet (set-ups where it applies):')
      for (const [key, tally] of [...goals.players].sort((a, b) => b[1].n - a[1].n)) {
        const engine = goals.engine.get(key)
        log(
          `    ${pct(tally.sum, tally.n).padStart(4)} ${pct(engine?.sum ?? 0, engine?.n ?? 0).padStart(4)}  n=${tally.n}  ${key}`,
        )
      }
      log('  rules from the formations, how often they hold for players and the engine:')
      for (const [key, tally] of [...formation.players].sort((a, b) => b[1].n - a[1].n)) {
        const engine = formation.engine.get(key)
        log(
          `    ${pct(tally.sum, tally.n).padStart(4)} ${pct(engine?.sum ?? 0, engine?.n ?? 0).padStart(4)}  n=${tally.n}  ${key}`,
        )
      }
      log()
    }
    if (skipped.size) log(`Rules left out: ${[...skipped].sort().join('; ')}`)

    // Each weight to tune is tried at shares of its value on the set-ups its
    // rules apply to. The live season suggests the value that puts the most
    // heroes on the player's tile, and the other seasons check it.
    for (const name of TUNE) {
      const value = liveData.weights[name]
      if (value === undefined) {
        log(`Tuning ${name}: no such weight`)
        continue
      }
      const touched = placed.filter(({ player }) =>
        player.goals.some(({ rule, met }) => rule.weight === name && met !== null),
      )
      const seasons = [...new Set(touched.map(({ setup }) => setup.season))].sort((a, b) => b - a)
      log(`Tuning ${name}, now ${value}, on the set-ups its rules apply to:`)
      const tried = TUNE_SHARES.map((share) => {
        const weights = { ...liveData.weights, [name]: share * value }
        const placedAt = new Map<string, PlacementResult>()
        const bySeason = new Map(
          seasons.map((season) => [
            season,
            { heroes: 0, onTile: 0, inBand: 0, players: 0, engine: 0, n: 0 },
          ]),
        )
        for (const { setup, player } of touched) {
          const key = teamKey(setup)
          // At its own value the weight leaves the run's placement as it was.
          let result = share === 1 ? engineOf(setup).result : placedAt.get(key)
          if (!result) {
            result = placeTeam(
              setup.team,
              setup.map,
              { ...dataOf(setup), weights },
              PLACEMENT_LOOKUPS,
              { buffTiles: setup.live },
            )
            placedAt.set(key, result)
          }
          const tally = bySeason.get(setup.season)!
          const band = bandsOf(setup.map)
          setup.team.heroes.forEach((hero) => {
            const mine = setup.tiles.get(hero)!
            const engine = result.positions[result.units.indexOf(hero)]!
            tally.heroes++
            if (mine === engine) tally.onTile++
            if (band.get(mine) === band.get(engine)) tally.inBand++
          })
          const metOf = (goals: GoalCheck[]) =>
            goals.find(({ rule, met }) => rule.weight === name && met !== null)?.met ?? 0
          tally.players += metOf(player.goals)
          tally.engine += metOf(result.goals)
          tally.n++
        }
        const line = seasons
          .map((season) => {
            const t = bySeason.get(season)!
            return `Season ${season} on tile ${pct(t.onTile, t.heroes)}, in band ${pct(t.inBand, t.heroes)}, met by players ${pct(t.players, t.n)} and the engine ${pct(t.engine, t.n)} (n=${t.n})`
          })
          .join('; ')
        log(`  ${+(share * value).toFixed(2)}: ${line}`)
        return { value: share * value, live: bySeason.get(LIVE) }
      })
      const best = tried
        .filter(({ live }) => live)
        .sort(
          (a, b) =>
            b.live!.onTile - a.live!.onTile || b.live!.inBand - a.live!.inBand || b.value - a.value,
        )[0]
      if (best) log(`  suggested: ${+best.value.toFixed(2)}`)
    }

    // The search against trying every placement, on the most used teams
    // whose placements can all be tried in a few seconds.
    if (FULL > 0) {
      const used = new Map<string, { setup: Setup; n: number }>()
      for (const { setup } of placed) {
        const key = teamKey(setup)
        used.set(key, { setup, n: (used.get(key)?.n ?? 0) + 1 })
      }
      const sample = [...used.values()]
        .sort((a, b) => b.n - a.n)
        .filter(({ setup }) => {
          const { result } = engineOf(setup)
          return (
            permutations(deploymentTiles(setup.map, Team.ALLY).size, result.units.length) <=
            FULL_LIMIT
          )
        })
        .slice(0, FULL)
      let sameBest = 0
      let samePick = 0
      const counts: string[] = []
      const times: number[] = []
      for (const { setup } of sample) {
        const { result } = engineOf(setup)
        const start = performance.now()
        const full = placeTeam(setup.team, setup.map, dataOf(setup), PLACEMENT_LOOKUPS, {
          buffTiles: setup.live,
          full: true,
        })
        times.push(performance.now() - start)
        if (
          full.best.broken === result.best.broken &&
          Math.abs(full.best.goals - result.best.goals) < 1e-9
        )
          sameBest++
        if (full.positions.join() === result.positions.join()) samePick++
        counts.push(`${result.equallyGood}${result.complete ? '' : '+'}/${full.equallyGood}`)
      }
      log(
        `Full search on ${sample.length} teams: the search found the best goals on ${sameBest}, the same pick on ${samePick}; equally good, search/full: ${counts.join(' ')}; full search median ${median(times).toFixed(0)} ms`,
      )
    }

    // The review page: the live season's most used teams, the engine's
    // formation beside the players' most common ones.
    const byTeam = new Map<
      string,
      { setup: Setup; players: Map<string, { player: Scored; n: number }> }
    >()
    for (const { setup, player } of placed.filter(({ setup }) => setup.live)) {
      const key = teamKey(setup)
      const entry = byTeam.get(key) ?? { setup, players: new Map() }
      const placed = player.positions.join()
      entry.players.set(placed, { player, n: (entry.players.get(placed)?.n ?? 0) + 1 })
      byTeam.set(key, entry)
    }
    const top = [...byTeam.values()]
      .map((entry) => ({ ...entry, n: [...entry.players.values()].reduce((s, p) => s + p.n, 0) }))
      .sort((a, b) => b.n - a.n)
      .slice(0, REVIEWED)
    const sections = top.map(({ setup, players, n }) => {
      const { result } = engineOf(setup)
      const units = result.units
      const common = [...players.values()].sort((a, b) => b.n - a.n).slice(0, 2)
      const title = [
        setup.team.heroes.map(nameOf).join(', '),
        setup.team.phantimal === undefined ? '' : ` + ${nameOf(setup.team.phantimal)}`,
        setup.team.artifact === undefined
          ? ''
          : `, ${nameOf(artifactById.get(setup.team.artifact)!.name)}`,
      ].join('')
      const engineCard = `<div class="card"><h3>Engine</h3>${boardSvg(setup.map, units, result.positions)}<p>${scoreLine(result.score)}, against enemy rules ${result.threats.toFixed(2)}; ${result.equallyGood}${result.complete ? '' : ' or more'} equally good</p><p class="kept">${setup.team.heroes.map((hero, i) => `${esc(nameOf(hero))} keeps ${result.kept[i]!.length}`).join(', ')}</p>${goalList(result.goals, result.formation)}</div>`
      const playerCards = common.map(
        ({ player, n: times }) =>
          `<div class="card"><h3>Players, ${times} of ${n} set-ups</h3>${boardSvg(setup.map, units, player.positions)}<p>${scoreLine(player.score)}, against enemy rules ${player.threats.toFixed(2)}</p>${goalList(player.goals, player.formation)}</div>`,
      )
      return `<section><h2>${esc(title)} <span>${setup.map}, ${n} set-ups</span></h2><div class="cards">${engineCard}${playerCards.join('')}</div></section>`
    })
    const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Placement review</title><style>
:root{--bg:#f6f5f2;--fg:#1d2228;--muted:#5d6670;--card:#fff;--line:#d9d6cf;--ally:#cfe3f7;--enemy:#f3d9d4;--wall:#8a8f96;--open:#ebe9e4;--buff:#c08a00;--met:#1f7a3a;--part:#9a6a00;--miss:#b3261e}
@media (prefers-color-scheme:dark){:root{--bg:#15181c;--fg:#e6e8ea;--muted:#9aa3ad;--card:#1e2328;--line:#343b43;--ally:#23415e;--enemy:#4e2a26;--wall:#59606a;--open:#2a3037;--buff:#e0b02a;--met:#5cc27a;--part:#e0b02a;--miss:#ff7b72;color-scheme:dark}}
body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.45 system-ui,sans-serif;padding:16px max(16px,env(safe-area-inset-left))}
h1{font-size:20px}h2{font-size:16px;margin:28px 0 8px;text-wrap:balance}h2 span{color:var(--muted);font-weight:400;font-size:13px}h3{font-size:13px;margin:0 0 6px}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px}.card{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:10px;min-width:0}
svg{width:100%;height:auto;max-width:340px;display:block}polygon,rect{stroke:var(--line);stroke-width:1}.ally{fill:var(--ally)}.enemy{fill:var(--enemy)}.wall{fill:var(--wall)}.open{fill:var(--open)}.buff{stroke:var(--buff);stroke-width:2.5}.held{stroke:var(--fg);stroke-width:1.5}
text{font-size:7px;text-anchor:middle;fill:var(--fg)}.pt{font-style:italic;fill:var(--muted)}
ul{margin:6px 0 0;padding-left:18px;font-size:12px}li.met b{color:var(--met)}li.part b{color:var(--part)}li.miss b{color:var(--miss)}.na{color:var(--muted)}p{margin:4px 0;font-size:12px}.kept{color:var(--muted)}.legend{list-style:none;display:flex;flex-wrap:wrap;gap:4px 12px;padding:0;margin:4px 0;color:var(--muted)}.legend li{display:flex;align-items:center;gap:4px}.legend svg{width:12px;height:12px}
pre{white-space:pre-wrap;font-size:12px;background:var(--card);border:1px solid var(--line);border-radius:8px;padding:10px;overflow-x:auto}
</style></head><body><h1>Placement review</h1><p>The engine's formation for the ${top.length} most used teams of Season ${LIVE}, beside the players' most common formations for the same team on the same map. Hover a name for the whole of it.</p><pre>${esc(lines.join('\n'))}</pre>${sections.join('')}</body></html>
`
    mkdirSync(OUT, { recursive: true })
    writeFileSync(join(OUT, 'measures.txt'), `${lines.join('\n')}\n`)
    writeFileSync(join(OUT, 'review.html'), page)
    console.log(lines.join('\n'))
  }, 3_600_000)
})
