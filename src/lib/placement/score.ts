import { getCompanions } from '../characters/companion'
import { inPhantimalBand } from '../characters/phantimal'
import { performPlace } from '../characters/place'
import { performRemove } from '../characters/remove'
import type { Hex } from '../hex'
import { buffTiles, deploymentTiles } from '../maps'
import { getCharacterSkill, type SkillContext } from '../skills/skill'
import { searchByRow } from '../skills/utils/ring'
import { findUnitBehind } from '../skills/utils/targeting'
import type { Rule, RuleGoal, RuleTeam } from '../types/rule'
import { State } from '../types/state'
import { Team } from '../types/team'
import { PlacementBoard } from './board'
import { artifactReach, charmReach, ruleUnit, skillReach, type Reach } from './reach'
import type { FormationRule, ListEntry, PlacementData, PlacementTeam } from './types'

// The list a rule falls back on when the team has none of its own list's heroes.
const FALLBACK_LIST = 'damage'

// The enemy units' rules are left out: they choose only among placements as
// good on these (threats()).
export interface PlacementScore {
  // Always rules from the formations that the placement breaks.
  broken: number
  // The team's goals, and its heroes on buff tiles.
  goals: number
  // The goals and the light preferences: where heroes lean, and usually rules.
  total: number
}

// How much of one rule's goal a placement meets, from 0 to 1, or null where the
// team cannot meet it (no listed hero, a map with nothing to count).
export interface GoalCheck {
  source: 'unit' | 'artifact' | 'charm'
  // The unit holding the effect, the artifact's name or the charm's id.
  owner: number | string
  rule: Rule
  met: number | null
}

export interface FormationCheck {
  rule: FormationRule
  held: boolean
}

// A rule the engine leaves out, and why.
export interface SkippedRule {
  owner: number | string
  reason: string
}

interface Effect {
  source: GoalCheck['source']
  owner: number | string
  // The unit of ours holding the effect, none for an artifact or an enemy unit.
  holder: number | undefined
  rule: Rule
  weight: number
  // Where the effect lands: once for an effect of ours, and for an enemy unit's
  // once for each enemy tile it could stand on, every tile as likely.
  reach: (board: PlacementBoard) => Reach[]
  // For a most goal: the most tiles the effect can count from any of the
  // holder's tiles on this map, with no other unit placed.
  best?: number
  // How many heroes a target goal wants, however many the effect reaches.
  marks: number
}

const isWall = (state: State): boolean =>
  state === State.BLOCKED || state === State.BLOCKED_BREAKABLE

// A list's heroes, the lists it brings in included. `seen` holds the lists on
// the way down, so a list two others bring in is read for each, and only a list
// that brings itself in fails.
function expandList(
  lists: PlacementData['lists'],
  name: string,
  seen: Set<string> = new Set(),
): number[] | undefined {
  const entries: ListEntry[] | undefined = lists[name]
  if (!entries || seen.has(name)) return undefined
  seen.add(name)
  const heroes: number[] = []
  for (const entry of entries) {
    const more = typeof entry === 'number' ? [entry] : expandList(lists, entry.list, seen)
    if (!more) return undefined
    for (const hero of more) if (!heroes.includes(hero)) heroes.push(hero)
  }
  seen.delete(name)
  return heroes
}

function goalList(goal: RuleGoal): string | undefined {
  if (typeof goal !== 'object') return undefined
  if ('target' in goal) return goal.target
  if ('include' in goal) return goal.include
  return 'avoid' in goal ? goal.avoid : undefined
}

/**
 * Scores the board a team stands on: its own rules, the rules of the enemy units
 * it could face there, its heroes on the map's buff tile, the rules found in the
 * formations, and where its heroes lean. Every rule reads where its effect lands
 * from the unit's skill as the board stands.
 */
export class PlacementScorer {
  readonly skipped: SkippedRule[] = []
  private readonly effects: Effect[] = []
  private readonly threatEffects: Effect[] = []
  // threatEffects' indexes, the heaviest rule first, each with the most the
  // rules after it can add.
  private readonly heaviest: { index: number; rest: number }[] = []
  readonly threatCeiling: number
  private readonly mustHold: FormationRule[]
  private readonly usually: FormationRule[]
  private readonly lists = new Map<string, number[] | undefined>()
  private readonly rankings = new Map<string, number[]>()
  private readonly enemyTiles: Set<number>
  // Ascending, the tiles an enemy unit is tried on.
  private readonly enemyOrder: number[]
  private readonly buffTiles: number[]
  // How far toward the enemy each ally tile is, from 0 at the back to 1 at the front.
  private readonly depth: Map<number, number>
  private readonly heroes: number[]
  private readonly front: number[]
  private readonly back: number[]
  private readonly weights: { buff: number; lean: number }

  constructor(
    private readonly board: PlacementBoard,
    team: PlacementTeam,
    private readonly data: PlacementData,
  ) {
    const { grid, mapKey, lookups } = board
    this.heroes = team.heroes
    this.enemyTiles = deploymentTiles(mapKey, Team.ENEMY)
    this.enemyOrder = [...this.enemyTiles].sort((a, b) => a - b)
    const allyTiles = new Set(board.tiles)
    this.buffTiles = buffTiles(mapKey).filter((hexId) => allyTiles.has(hexId))
    const enemyHexes = [...this.enemyTiles].map((hexId) => grid.getHexById(hexId))
    const near = new Map(
      board.tiles.map((hexId) => {
        const hex = grid.getHexById(hexId)
        return [hexId, Math.min(...enemyHexes.map((other) => hex.distance(other)))]
      }),
    )
    const nearest = Math.min(...near.values())
    const farthest = Math.max(...near.values())
    this.depth = new Map(
      [...near].map(([hexId, d]) => [hexId, (farthest - d) / (farthest - nearest || 1)]),
    )
    this.front = data.leans.front.filter((hero) => team.heroes.includes(hero))
    this.back = data.leans.back.filter((hero) => team.heroes.includes(hero))
    this.weights = { buff: this.weightOf('buff'), lean: this.weightOf('lean') }

    const formation = data.formationRules.filter((rule) =>
      rule.heroes.every((hero) => team.heroes.includes(hero)),
    )
    this.mustHold = formation.filter((rule) => rule.holds === 'always')
    this.usually = formation.filter((rule) => rule.holds === 'usually')

    const units = team.phantimal === undefined ? team.heroes : [...team.heroes, team.phantimal]
    for (const unit of units) {
      const rules = lookups.rulesOf(unit)
      if (rules.some((rule) => rule.team === 'ally') && !getCharacterSkill(unit)) {
        this.skipped.push({ owner: unit, reason: 'no skill' })
        continue
      }
      for (const rule of rules) {
        this.addEffect('unit', unit, unit, rule, (b) => [skillReach(b.manager, unit, Team.ALLY)])
      }
    }
    // An enemy unit stands alone on its side, so a skill that reads its own
    // teammates finds none.
    for (const [id, share] of Object.entries(data.pickRates[mapKey] ?? {})) {
      const unit = Number(id)
      const rules = lookups.rulesOf(unit)
      if (rules.some((rule) => rule.team === 'enemy') && !getCharacterSkill(unit)) {
        this.skipped.push({ owner: unit, reason: 'no skill' })
        continue
      }
      const reach = ({ grid, manager }: PlacementBoard): Reach[] =>
        this.enemyOrder.flatMap((hexId) => {
          if (!performPlace(grid, hexId, unit, Team.ENEMY)) return []
          manager.activateCharacterSkill(unit, hexId, Team.ENEMY, grid)
          const found = skillReach(manager, unit, Team.ENEMY)
          manager.deactivateCharacterSkill(unit, hexId, Team.ENEMY, grid)
          performRemove(grid, hexId)
          return [found]
        })
      for (const rule of rules) this.addEffect('unit', unit, undefined, rule, reach, 'enemy', share)
    }
    for (const hero of team.heroes) {
      const charm = lookups.charmOf(hero)
      for (const rule of charm?.rules ?? []) {
        this.addEffect('charm', charm!.id, hero, rule, (b) => [
          charmReach(this.contextOf(b, hero), rule.tile!),
        ])
      }
    }
    const artifact = team.artifact === undefined ? undefined : lookups.artifactOf(team.artifact)
    for (const rule of artifact?.rules ?? []) {
      this.addEffect('artifact', artifact!.name, undefined, rule, (b) => [
        artifactReach(b.grid, Team.ALLY, artifact!.name),
      ])
    }

    const order = [...this.threatEffects.keys()].sort(
      (a, b) => this.threatEffects[b]!.weight - this.threatEffects[a]!.weight,
    )
    let rest = 0
    for (let k = order.length - 1; k >= 0; k--) {
      this.heaviest[k] = { index: order[k]!, rest }
      rest += Math.max(0, this.threatEffects[order[k]!]!.weight)
    }
    this.threatCeiling = rest
  }

  score(): PlacementScore {
    let goals = this.weights.buff * this.onBuffTiles()
    for (const effect of this.effects) goals += effect.weight * (this.meet(effect) ?? 0)
    let broken = 0
    for (const rule of this.mustHold) if (!this.held(rule)) broken++
    let light = this.leaning()
    for (const rule of this.usually) if (this.held(rule)) light++
    return { broken, goals, total: goals + this.weights.lean * light }
  }

  // The points for the enemy units' rules the board blunts, each scaled by how
  // often its unit is on the map.
  threats(): number {
    return this.threatsReaching(-Infinity)!
  }

  // threats(), or null once the board cannot reach `needed`: the heaviest rules
  // are read first and the rest counted at their most. The points are added in
  // the rules' own order, so the sum is the same whichever order they were read in.
  threatsReaching(needed: number): number | null {
    const points = new Array<number>(this.threatEffects.length).fill(0)
    let read = 0
    for (const { index, rest } of this.heaviest) {
      const effect = this.threatEffects[index]!
      points[index] = effect.weight * (this.meet(effect) ?? 0)
      read += points[index]!
      if (read + rest < needed) return null
    }
    let sum = 0
    for (const value of points) sum += value
    return sum
  }

  goals(): GoalCheck[] {
    return [...this.effects, ...this.threatEffects].map((effect) => ({
      source: effect.source,
      owner: effect.owner,
      rule: effect.rule,
      met: this.meet(effect),
    }))
  }

  formation(): FormationCheck[] {
    return [...this.mustHold, ...this.usually].map((rule) => ({ rule, held: this.held(rule) }))
  }

  private weightOf(name: string): number {
    const weight = this.data.weights[name]
    if (weight === undefined) this.skipped.push({ owner: name, reason: 'no weight' })
    return weight ?? 0
  }

  private list(name: string): number[] | undefined {
    if (!this.lists.has(name)) this.lists.set(name, expandList(this.data.lists, name))
    return this.lists.get(name)
  }

  private addEffect(
    source: Effect['source'],
    owner: number | string,
    holder: number | undefined,
    rule: Rule,
    reach: Effect['reach'],
    team: RuleTeam = 'ally',
    // How often an enemy unit is on the map, which its rule's weight is scaled by.
    share = 1,
  ): void {
    if (rule.team !== team || rule.goal === 'none' || rule.weight === undefined) return
    if (source === 'charm' && !rule.tile) {
      this.skipped.push({ owner, reason: 'a charm rule names no tile' })
      return
    }
    const listName = goalList(rule.goal)
    for (const name of listName === undefined ? [] : [listName, FALLBACK_LIST]) {
      if (!this.list(name)) {
        this.skipped.push({ owner, reason: `no list ${name}` })
        return
      }
    }
    const weight = this.data.weights[rule.weight]
    if (weight === undefined) {
      this.skipped.push({ owner, reason: `no weight ${rule.weight}` })
      return
    }
    // A phantimal and each of its companions give a Spirit Mark of their own,
    // so a mark that finds no hero leaves its share of the goal unmet.
    const marks =
      holder !== undefined && inPhantimalBand(holder)
        ? 1 + getCompanions(this.board.grid, holder, Team.ALLY).size
        : 1
    const effect: Effect = { source, owner, holder, rule, weight: weight * share, reach, marks }
    if (rule.goal === 'most' || (typeof rule.goal === 'object' && 'most' in rule.goal)) {
      effect.best = holder === undefined ? 0 : this.bestCount(effect, holder)
    }
    ;(team === 'ally' ? this.effects : this.threatEffects).push(effect)
  }

  // The most tiles a most goal can count, trying the holder on each ally tile of
  // a board of its own: what it counts, the enemy's tiles or its walls, depends
  // on where the holder stands, not on its team.
  private bestCount(effect: Effect, holder: number): number {
    const { mapKey, lookups } = this.board
    const solo = new PlacementBoard(
      inPhantimalBand(holder) ? { heroes: [], phantimal: holder } : { heroes: [holder] },
      mapKey,
      lookups,
    )
    let best = 0
    for (const hexId of solo.tiles) {
      const rest = solo.tiles.filter((other) => other !== hexId)
      solo.place([hexId, ...rest.slice(0, solo.units.length - 1)])
      best = Math.max(best, this.countMarked(effect.rule.goal, effect.reach(solo)[0]!.marked, solo))
    }
    return best
  }

  private countMarked(goal: RuleGoal, marked: number[], board: PlacementBoard): number {
    if (goal === 'most') return marked.filter((hexId) => this.enemyTiles.has(hexId)).length
    // The enemy's side: the rows past the middle one.
    const enemySide = (hex: Hex) => hex.getDiagonal() > 0
    return marked.filter((hexId) => {
      const tile = board.grid.getTileById(hexId)
      return isWall(tile.state) && enemySide(tile.hex)
    }).length
  }

  private contextOf(board: PlacementBoard, unit: number): SkillContext {
    return {
      grid: board.grid,
      hexId: board.tileOf(unit),
      team: Team.ALLY,
      characterId: unit,
      skillManager: board.manager,
      lookups: board.lookups,
    }
  }

  private ranked(name: string, holder: number | undefined): number[] {
    const key = `${name}|${holder}`
    let order = this.rankings.get(key)
    if (!order) {
      const others = this.heroes.filter((hero) => hero !== holder)
      order = this.list(name)!.filter((hero) => others.includes(hero))
      if (!order.length) order = this.list(FALLBACK_LIST)!.filter((hero) => others.includes(hero))
      this.rankings.set(key, order)
    }
    return order
  }

  // The share met, averaged over the ways the effect can stand where it applies.
  private meet(effect: Effect): number | null {
    let sum = 0
    let count = 0
    for (const reach of effect.reach(this.board)) {
      const met = this.meetOnce(effect, reach)
      if (met === null) continue
      sum += met
      count++
    }
    return count ? sum / count : null
  }

  private meetOnce(effect: Effect, { landed, marked }: Reach): number | null {
    const { rule, holder } = effect
    const { goal } = rule
    const self = holder === undefined ? undefined : ruleUnit(holder)
    const unitsOn = (hexIds: number[], asRuleUnit = true): Set<number> => {
      const units = new Set<number>()
      for (const hexId of hexIds) {
        const tile = this.board.grid.getTileById(hexId)
        if (tile.characterId === undefined || tile.team !== Team.ALLY) continue
        if (ruleUnit(tile.characterId) === self) continue
        units.add(asRuleUnit ? ruleUnit(tile.characterId) : tile.characterId)
      }
      return units
    }

    if (goal === 'none') return null
    if (goal === 'most' || 'most' in goal) {
      return effect.best ? this.countMarked(goal, marked, this.board) / effect.best : null
    }
    if ('atMost' in goal) return unitsOn(marked).size <= goal.atMost ? 1 : 0
    if ('exactly' in goal) {
      // A companion takes a tile of its own, so it counts as a unit other than
      // the team's heroes, as a phantimal does.
      const on = [...unitsOn(marked, false)]
      if (on.length !== goal.exactly) return 0
      if (
        goal.sameFaction &&
        new Set(on.map((unit) => this.board.lookups.factionOf(ruleUnit(unit)))).size !== 1
      )
        return 0
      return on.some((unit) => !this.heroes.includes(unit)) ? (goal.nonHero ?? 1) : 1
    }

    const order = this.ranked(goalList(goal)!, self)
    if (!order.length) return null
    const hit = unitsOn([...landed, ...marked])
    if ('avoid' in goal) return hit.has(order[0]!) ? 0 : 1
    if ('target' in goal) {
      // An effect that lands on two wants the list's first two, half each.
      const count = Math.max(effect.marks, hit.size)
      return order.slice(0, count).filter((hero) => hit.has(hero)).length / count
    }
    // Include: a share for each listed hero among those it reaches, where a
    // single target needs only one of them.
    const slots = marked.length ? order.length : 1
    return Math.min(1, order.filter((hero) => hit.has(hero)).length / slots)
  }

  private held(rule: FormationRule): boolean {
    const { board } = this
    const tileOf = (hero: number) => board.tileOf(hero)
    const [a, b] = rule.heroes as [number, number]
    const tiles = this.heroes.map(tileOf).sort((x, y) => y - x)
    const isHero = (unit: number) => this.heroes.includes(unit)
    const nearestOnRow = (from: number, to: number) =>
      searchByRow(this.contextOf(board, from), Team.ALLY, isHero)?.targetHexId === tileOf(to)
    switch (rule.relation) {
      case 'frontmost':
        return tileOf(a) === tiles[0]
      case 'twoFrontmost':
        return tiles.indexOf(tileOf(a)) < 2
      case 'rearmost':
        return tileOf(a) === tiles[tiles.length - 1]
      case 'twoRearmost':
        return tiles.indexOf(tileOf(a)) >= tiles.length - 2
      case 'inFrontOf':
        return tileOf(a) > tileOf(b)
      case 'nextTo':
        return board.grid.getHexById(tileOf(a)).distance(board.grid.getHexById(tileOf(b))) === 1
      case 'behind':
        return findUnitBehind(this.contextOf(board, a))?.targetHexId === tileOf(b)
      case 'nearestOnRow':
        return nearestOnRow(a, b)
      case 'mutualNearestOnRow':
        return nearestOnRow(a, b) && nearestOnRow(b, a)
    }
  }

  private onBuffTiles(): number {
    return this.buffTiles.filter((hexId) => {
      const unit = this.board.grid.getTileById(hexId).characterId
      return unit !== undefined && !inPhantimalBand(unit)
    }).length
  }

  private leaning(): number {
    const depthOf = (hero: number) => this.depth.get(this.board.tileOf(hero))!
    let lean = 0
    for (const hero of this.front) lean += depthOf(hero)
    for (const hero of this.back) lean += 1 - depthOf(hero)
    return lean
  }
}
