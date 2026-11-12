import { getCompanions } from '../characters/companion'
import { inPhantimalBand } from '../characters/phantimal'
import { performPlace } from '../characters/place'
import { performRemove } from '../characters/remove'
import type { Grid } from '../grid'
import type { Hex } from '../hex'
import { configTiles } from '../maps'
import { defaultCanTraverse } from '../pathfinding'
import { getCharacterSkill, type SkillContext } from '../skills/skill'
import type { Rule, RuleGoal, RuleTeam } from '../types/rule'
import { State } from '../types/state'
import { Team } from '../types/team'
import { PlacementBoard } from './board'
import { goalList } from './goals'
import { expandList, type ListHeroes } from './lists'
import { artifactReach, ruleUnit, skillReach, tileReach, type Reach } from './reach'
import type { PlacementData, PlacementTeam } from './types'

// The list a rule falls back on when the team has none of its own list's heroes.
const FALLBACK_LIST = 'damage'
// What a hero below a list's line counts for a rule that counts every listed
// hero it reaches, while a hero above the line is on the team.
const BELOW_LINE = 0.9

// The enemy units' rules are left out: they choose only among placements as
// good on these (threats()).
export interface PlacementScore {
  // The team's goals, and its heroes on buff tiles.
  goals: number
  // The goals and the light preference of where heroes lean.
  total: number
}

// How much of one rule's goal a placement meets, from 0 to 1, or null where the
// team cannot meet it (no listed hero, a map with nothing to count).
interface GoalCheck {
  source: 'unit' | 'artifact' | 'charm'
  // The unit holding the effect, the artifact's name or the charm's id.
  owner: number | string
  rule: Rule
  met: number | null
}

// One of the team's own goals, with the units it counts as met on: the listed
// heroes the effect reaches, or the units an exactly goal covers. `to` holds
// the units it goes to: every ally a target goal's effect lands on, listed or
// not, else those of `on`.
export interface OwnGoalCheck extends GoalCheck {
  holder: number | undefined
  on: number[]
  to: number[]
}

// A rule the engine leaves out, and why.
interface SkippedRule {
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
  // For a most goal: the most the effect can count from any of the holder's
  // tiles on this map.
  best?: number
  // How many heroes a target goal wants, however many the effect reaches.
  marks: number
}

const countsAllies = (goal: RuleGoal): boolean =>
  typeof goal === 'object' && 'most' in goal && goal.most === 'allies'

const isWall = (state: State): boolean =>
  state === State.BLOCKED || state === State.BLOCKED_BREAKABLE

// Each tile a unit can walk to from the given tiles round the walls, with its
// fewest steps.
function walkingSteps(grid: Grid, from: Iterable<number>): Map<number, number> {
  let frontier = [...from]
  const steps = new Map(frontier.map((hexId) => [hexId, 0]))
  while (frontier.length) {
    const next: number[] = []
    for (const hexId of frontier) {
      for (const hex of grid.getHexById(hexId).getNeighbors()) {
        const tile = grid.getTileOrUndefined(hex)
        if (!tile || !defaultCanTraverse(tile) || steps.has(tile.hex.getId())) continue
        steps.set(tile.hex.getId(), steps.get(hexId)! + 1)
        next.push(tile.hex.getId())
      }
    }
    frontier = next
  }
  return steps
}

const fallsBack = (goal: RuleGoal): boolean =>
  !(typeof goal === 'object' && 'target' in goal && goal.fallback === false)

/**
 * Scores the board a team stands on: its own rules, the rules of the enemy units
 * it could face there, its heroes on the map's buff tile, and where its heroes
 * lean. Every rule reads where its effect lands from the unit's skill as the
 * board stands.
 */
export class PlacementScorer {
  readonly skipped: SkippedRule[] = []
  private readonly effects: Effect[] = []
  private readonly threatEffects: Effect[] = []
  // threatEffects' indexes, the heaviest rule first, each with the most the
  // rules after it can add.
  private readonly heaviest: { index: number; rest: number }[] = []
  readonly threatCeiling: number
  private readonly lists = new Map<string, ListHeroes | undefined>()
  private readonly rankings = new Map<string, { order: number[]; above: number }>()
  private readonly enemyTiles: Set<number>
  // Ascending, the tiles an enemy unit is tried on.
  private readonly enemyOrder: number[]
  private readonly buffTiles: number[]
  // How far toward the enemy each ally tile is, walking round the walls, from 0
  // at the back to 1 at the front. A tile with no way to the enemy is at the back.
  readonly depth: Map<number, number>
  // The ally tiles with no way to the enemy at the start.
  private readonly sealed: Set<number>
  private readonly heroes: number[]
  private readonly front: number[]
  private readonly back: number[]
  private readonly weights: { buff: number; lean: number; walled: number }

  constructor(
    private readonly board: PlacementBoard,
    team: PlacementTeam,
    private readonly data: PlacementData,
  ) {
    const { grid, layout, lookups } = board
    this.heroes = team.heroes
    this.enemyTiles = configTiles(layout.config, Team.ENEMY)
    this.enemyOrder = [...this.enemyTiles].sort((a, b) => a - b)
    const allyTiles = new Set(board.tiles)
    this.buffTiles = layout.buffTiles.filter((hexId) => allyTiles.has(hexId))
    const steps = walkingSteps(grid, this.enemyTiles)
    const reached = board.tiles.flatMap((hexId) => steps.get(hexId) ?? [])
    const nearest = reached.length ? Math.min(...reached) : 0
    const farthest = reached.length ? Math.max(...reached) : 0
    this.sealed = new Set(board.tiles.filter((hexId) => !steps.has(hexId)))
    this.depth = new Map(
      board.tiles.map((hexId) => [
        hexId,
        (farthest - (steps.get(hexId) ?? farthest)) / (farthest - nearest || 1),
      ]),
    )
    this.front = data.leans.front.filter((hero) => team.heroes.includes(hero))
    this.back = data.leans.back.filter((hero) => team.heroes.includes(hero))
    this.weights = {
      buff: this.weightOf('buff'),
      lean: this.weightOf('lean'),
      walled: this.weightOf('walled'),
    }

    const units = team.phantimal === undefined ? team.heroes : [...team.heroes, team.phantimal]
    for (const unit of units) {
      const rules = lookups.rulesOf(unit)
      const fromSkill = rules.some(
        (rule) => rule.team === 'ally' && !rule.tile && rule.goal !== 'back',
      )
      if (fromSkill && !getCharacterSkill(unit)) {
        this.skipped.push({ owner: unit, reason: 'no skill' })
        continue
      }
      for (const rule of rules) {
        this.addEffect('unit', unit, unit, rule, (b) => {
          if (rule.goal === 'back') return [{ landed: [], marked: [] }]
          const others = b.units.filter((other) => other !== unit && ruleUnit(other) === unit)
          if (!rule.tile) {
            const bodies = rule.from === 'companion' ? others : [unit]
            return [skillReach(b.manager, unit, Team.ALLY, bodies)]
          }
          const from = rule.from === 'companion' ? others[0] : unit
          return from === undefined ? [] : [tileReach(this.contextOf(b, from), rule)]
        })
      }
    }
    // An enemy unit stands alone on its side, so a skill that reads its own
    // teammates finds none; a rule that names its tiles reads them instead.
    for (const [id, share] of Object.entries(data.pickRates[layout.key] ?? {})) {
      const unit = Number(id)
      const rules = lookups.rulesOf(unit)
      if (rules.some((rule) => rule.team === 'enemy' && !rule.tile) && !getCharacterSkill(unit)) {
        this.skipped.push({ owner: unit, reason: 'no skill' })
        continue
      }
      const reach =
        (rule: Rule) =>
        ({ grid, manager }: PlacementBoard): Reach[] =>
          this.enemyOrder.flatMap((hexId) => {
            if (rule.tile) {
              const holder = { grid, hexId, team: Team.ENEMY, characterId: unit }
              return [tileReach({ ...holder, skillManager: manager, lookups }, rule)]
            }
            if (!performPlace(grid, hexId, unit, Team.ENEMY)) return []
            manager.activateCharacterSkill(unit, hexId, Team.ENEMY, grid)
            const found = skillReach(manager, unit, Team.ENEMY)
            manager.deactivateCharacterSkill(unit, hexId, Team.ENEMY, grid)
            performRemove(grid, hexId)
            return [found]
          })
      for (const rule of rules) {
        this.addEffect('unit', unit, undefined, rule, reach(rule), 'enemy', share)
      }
    }
    for (const hero of team.heroes) {
      const charm = lookups.charmOf(hero)
      for (const rule of charm?.rules ?? []) {
        this.addEffect('charm', charm!.id, hero, rule, (b) => [
          tileReach(this.contextOf(b, hero), rule),
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
    const goals =
      this.addEffects(this.weights.buff * this.onBuffTiles()) -
      this.weights.walled * this.walledIn()
    return { goals, total: goals + this.weights.lean * this.leaning() }
  }

  // The points the team's own goals earn as the board stands, the buff tile's
  // left out.
  effectPoints(): number {
    return this.addEffects(0)
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

  ownGoals(): OwnGoalCheck[] {
    return this.effects.map((effect) => {
      const on: number[] = []
      const [reach] = effect.reach(this.board)
      const { source, owner, holder, rule } = effect
      if (!reach) return { source, owner, holder, rule, met: null, on, to: on }
      const met = this.meetOnce(effect, reach, on)
      const to =
        typeof rule.goal === 'object' && 'target' in rule.goal
          ? [...this.alliesOn([...reach.landed, ...reach.marked], holder, false)]
          : on
      return { source, owner, holder, rule, met, on, to }
    })
  }

  onBuffTile(unit: number): boolean {
    return (
      this.weights.buff > 0 &&
      !inPhantimalBand(unit) &&
      this.buffTiles.includes(this.board.tileOf(unit))
    )
  }

  leanOf(hero: number): 'front' | 'back' | undefined {
    if (this.front.includes(hero)) return 'front'
    return this.back.includes(hero) ? 'back' : undefined
  }

  private addEffects(points: number): number {
    for (const effect of this.effects) points += effect.weight * (this.meet(effect) ?? 0)
    return points
  }

  private weightOf(name: string): number {
    const weight = this.data.weights[name]
    if (weight === undefined) this.skipped.push({ owner: name, reason: 'no weight' })
    return weight ?? 0
  }

  private list(name: string): ListHeroes | undefined {
    if (!this.lists.has(name)) {
      this.lists.set(name, expandList(this.data.lists, name, this.board.lookups))
    }
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
    const names = listName === undefined ? [] : [listName]
    if (listName !== undefined && fallsBack(rule.goal)) names.push(FALLBACK_LIST)
    for (const name of names) {
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
    // A phantimal's companions give a Spirit Mark each, read by a rule of their
    // own, so a mark that finds no hero leaves its share of that goal unmet.
    const marks =
      holder !== undefined && inPhantimalBand(holder) && rule.from === 'companion'
        ? Math.max(1, getCompanions(this.board.grid, holder, Team.ALLY).size)
        : 1
    const effect: Effect = { source, owner, holder, rule, weight: weight * share, reach, marks }
    if (rule.goal === 'most' || (typeof rule.goal === 'object' && 'most' in rule.goal)) {
      effect.best = holder === undefined ? 0 : this.bestCount(effect, holder)
    }
    ;(team === 'ally' ? this.effects : this.threatEffects).push(effect)
  }

  // The most a most goal can count, trying the holder on each ally tile of a
  // board of its own: what it counts, the enemy's tiles or its walls, depends
  // on where the holder stands, not on its team. Allies count on the marked
  // tiles an ally can stand on, at most every other unit of the team.
  private bestCount(effect: Effect, holder: number): number {
    const { layout, lookups } = this.board
    const { goal } = effect.rule
    const solo = new PlacementBoard(
      inPhantimalBand(holder) ? { heroes: [], phantimal: holder } : { heroes: [holder] },
      layout,
      lookups,
    )
    const allyTiles = new Set(solo.tiles)
    const others = this.board.units.filter((unit) => ruleUnit(unit) !== ruleUnit(holder)).length
    let best = 0
    for (const hexId of solo.tiles) {
      const rest = solo.tiles.filter((other) => other !== hexId)
      solo.place([hexId, ...rest.slice(0, solo.units.length - 1)])
      const { marked } = effect.reach(solo)[0]!
      const count = countsAllies(goal)
        ? Math.min(others, marked.filter((tile) => allyTiles.has(tile)).length)
        : this.countMarked(goal, marked, solo, holder)
      best = Math.max(best, count)
    }
    return best
  }

  private countMarked(
    goal: RuleGoal,
    marked: number[],
    board: PlacementBoard,
    holder: number | undefined,
  ): number {
    if (goal === 'most') return marked.filter((hexId) => this.enemyTiles.has(hexId)).length
    if (countsAllies(goal)) return this.alliesOn(marked, holder, false, board).size
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

  // The team's heroes on the goal's list but the holder: those above its line
  // in order, then those below it, with how many are above.
  private ranked(goal: RuleGoal, holder: number | undefined): { order: number[]; above: number } {
    const name = goalList(goal)!
    const fallback = fallsBack(goal)
    const key = `${name}|${holder}|${fallback}`
    let found = this.rankings.get(key)
    if (!found) {
      const others = this.heroes.filter((hero) => hero !== holder)
      const onTeam = ({ ranked, equal }: ListHeroes) => {
        const above = ranked.filter((hero) => others.includes(hero))
        return {
          order: [...above, ...equal.filter((hero) => others.includes(hero))],
          above: above.length,
        }
      }
      found = onTeam(this.list(name)!)
      if (!found.order.length && fallback) found = onTeam(this.list(FALLBACK_LIST)!)
      this.rankings.set(key, found)
    }
    return found
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

  // The ally units on these tiles but the holder and its companions, each as a
  // rule names it or as itself.
  private alliesOn(
    hexIds: number[],
    holder: number | undefined,
    asRuleUnit = true,
    board = this.board,
  ): Set<number> {
    const self = holder === undefined ? undefined : ruleUnit(holder)
    const units = new Set<number>()
    for (const hexId of hexIds) {
      const tile = board.grid.getTileById(hexId)
      if (tile.characterId === undefined || tile.team !== Team.ALLY) continue
      if (ruleUnit(tile.characterId) === self) continue
      units.add(asRuleUnit ? ruleUnit(tile.characterId) : tile.characterId)
    }
    return units
  }

  // `counted` collects the units the goal is met on.
  private meetOnce(effect: Effect, { landed, marked }: Reach, counted?: number[]): number | null {
    const { rule, holder } = effect
    const { goal } = rule
    const self = holder === undefined ? undefined : ruleUnit(holder)

    if (goal === 'none') return null
    // The middle of the ally tiles is in both halves, as for a lean.
    if (goal === 'back') return this.depth.get(this.board.tileOf(holder!))! <= 0.5 ? 1 : 0
    if (goal === 'companion') {
      const bodies = this.board.units.filter((unit) => unit !== holder && ruleUnit(unit) === self)
      if (!bodies.length) return null
      return bodies.some((unit) => marked.includes(this.board.tileOf(unit))) ? 1 : 0
    }
    if (goal === 'most' || 'most' in goal) {
      return effect.best ? this.countMarked(goal, marked, this.board, holder) / effect.best : null
    }
    if ('atMost' in goal) return this.alliesOn(marked, holder).size <= goal.atMost ? 1 : 0
    if ('exactly' in goal) {
      // A companion takes a tile of its own, so it counts as a unit other than
      // the team's heroes, as a phantimal does.
      const on = [...this.alliesOn(marked, holder, false)]
      if (on.length !== goal.exactly) return 0
      if (
        goal.sameFaction &&
        new Set(on.map((unit) => this.board.lookups.factionOf(ruleUnit(unit)))).size !== 1
      )
        return 0
      counted?.push(...new Set(on.map(ruleUnit)))
      return on.some((unit) => !this.heroes.includes(unit)) ? (goal.nonHero ?? 1) : 1
    }

    const { order, above } = this.ranked(goal, self)
    if (!order.length) return null
    // A hero's lean comes before a Spirit Mark: the Mark counts only on a hero
    // standing in the half it leans to, or on one with no lean.
    const tiles = [...landed, ...marked]
    const hit = this.alliesOn(
      holder !== undefined && inPhantimalBand(holder)
        ? tiles.filter((hexId) => !this.offSide(hexId))
        : tiles,
      holder,
    )
    // With nobody above the line on the team, nobody is worth guarding.
    if ('avoid' in goal) return above ? (hit.has(order[0]!) ? 0 : 1) : null
    if ('target' in goal) {
      // An effect that lands on two wants the list's first two, half each. A
      // place the heroes above the line leave open goes to any hero below it.
      const count = Math.max(effect.marks, hit.size)
      const top = order.slice(0, Math.min(count, above))
      const reached = [
        ...top.filter((hero) => hit.has(hero)),
        ...order
          .slice(above)
          .filter((hero) => hit.has(hero))
          .slice(0, count - top.length),
      ]
      // A unit other than the team's heroes, such as a phantimal, earns no
      // others share: the effect is for a hero.
      const others = goal.others
        ? [...hit]
            .filter((unit) => this.heroes.includes(unit) && !reached.includes(unit))
            .slice(0, count - reached.length)
        : []
      counted?.push(...reached, ...others)
      return (reached.length + (goal.others ?? 0) * others.length) / count
    }
    // Include: a share for each listed hero among those it reaches, where a
    // single target needs only one of them.
    const slots = marked.length ? order.length : 1
    const reached = order.filter((hero) => hit.has(hero))
    counted?.push(...reached)
    const below = above ? BELOW_LINE : 1
    const points = reached.reduce((sum, hero) => sum + (order.indexOf(hero) < above ? 1 : below), 0)
    return Math.min(1, points / slots)
  }

  private onBuffTiles(): number {
    return this.buffTiles.filter((hexId) => {
      const unit = this.board.grid.getTileById(hexId).characterId
      return unit !== undefined && !inPhantimalBand(unit)
    }).length
  }

  private walledIn(): number {
    return this.heroes.filter(
      (hero) => this.board.lookups.rangeOf(hero) === 1 && this.sealed.has(this.board.tileOf(hero)),
    ).length
  }

  private offSide(hexId: number): boolean {
    const unit = this.board.grid.getTileById(hexId).characterId
    if (unit === undefined) return false
    const hero = ruleUnit(unit)
    const depth = this.depth.get(hexId)
    if (depth === undefined) return false
    return (this.front.includes(hero) && depth < 0.5) || (this.back.includes(hero) && depth > 0.5)
  }

  private leaning(): number {
    const depthOf = (hero: number) => this.depth.get(this.board.tileOf(hero))!
    let lean = 0
    for (const hero of this.front) lean += depthOf(hero)
    for (const hero of this.back) lean += 1 - depthOf(hero)
    return lean
  }
}
