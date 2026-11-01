import { toBaseHeroId } from '../characters/character'
import { inPhantimalBand, phantimalOwnerId } from '../characters/phantimal'
import { performPlace } from '../characters/place'
import { performRemove } from '../characters/remove'
import type { Hex } from '../hex'
import { buffTiles, deploymentTiles } from '../maps'
import { artifactTargetArrows } from '../skills/artifact'
import { getCharacterSkill, type SkillContext, type SkillManager } from '../skills/skill'
import { searchByRow } from '../skills/utils/ring'
import { findUnitBehind, findUnitInFront } from '../skills/utils/targeting'
import type { Rule, RuleGoal, RuleTeam } from '../types/rule'
import { State } from '../types/state'
import { Team } from '../types/team'
import { PlacementBoard } from './board'
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

interface Reach {
  landed: number[]
  marked: number[]
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
}

// The unit a rule counts: a companion as its hero, a phantimal's companion as
// its phantimal.
const identity = (unitId: number): number =>
  inPhantimalBand(unitId) ? phantimalOwnerId(unitId) : toBaseHeroId(unitId)

// Where a unit's skill lands and the tiles it marks, as the board stands.
function reachOf(manager: SkillManager, unit: number, team: Team): Reach {
  const target = manager.getSkillTarget(unit, team)
  const landed = target?.metadata?.arrows?.map((arrow) => arrow.toHexId) ?? []
  if (target?.targetHexId != null) landed.push(target.targetHexId)
  return { landed, marked: manager.getMarkedTiles(unit, team) }
}

const isWall = (state: State): boolean =>
  state === State.BLOCKED || state === State.BLOCKED_BREAKABLE

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
  return heroes
}

const goalList = (goal: RuleGoal): string | undefined =>
  typeof goal === 'object'
    ? 'target' in goal
      ? goal.target
      : 'include' in goal
        ? goal.include
        : 'avoid' in goal
          ? goal.avoid
          : undefined
    : undefined

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
  private readonly mustHold: FormationRule[]
  private readonly usually: FormationRule[]
  private readonly lists = new Map<string, number[] | undefined>()
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
    options: { buffTiles: boolean },
  ) {
    const { grid, mapKey, lookups } = board
    this.heroes = team.heroes
    this.enemyTiles = deploymentTiles(mapKey, Team.ENEMY)
    this.enemyOrder = [...this.enemyTiles].sort((a, b) => a - b)
    const allyTiles = new Set(board.tiles)
    this.buffTiles = options.buffTiles
      ? buffTiles(mapKey).filter((hexId) => allyTiles.has(hexId))
      : []
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
        this.addEffect('unit', unit, unit, rule, (b) => [reachOf(b.manager, unit, Team.ALLY)])
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
          const found = reachOf(manager, unit, Team.ENEMY)
          manager.deactivateCharacterSkill(unit, hexId, Team.ENEMY, grid)
          performRemove(grid, hexId)
          return [found]
        })
      for (const rule of rules) this.addEffect('unit', unit, undefined, rule, reach, 'enemy', share)
    }
    for (const hero of team.heroes) {
      const charm = lookups.charmOf(hero)
      for (const rule of charm?.rules ?? []) {
        const find = rule.tile === 'behind' ? findUnitBehind : findUnitInFront
        this.addEffect('charm', charm!.id, hero, rule, (b) => {
          const found = find(this.contextOf(b, hero))?.targetHexId
          return [{ landed: found == null ? [] : [found], marked: [] }]
        })
      }
    }
    const artifact = team.artifact === undefined ? undefined : lookups.artifactOf(team.artifact)
    for (const rule of artifact?.rules ?? []) {
      this.addEffect('artifact', artifact!.name, undefined, rule, (b) => [
        {
          landed: artifactTargetArrows(b.grid, Team.ALLY, artifact!.name).map((arrow) =>
            arrow.toHex.getId(),
          ),
          marked: [],
        },
      ])
    }
  }

  // The board's score as it stands.
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
    let points = 0
    for (const effect of this.threatEffects) points += effect.weight * (this.meet(effect) ?? 0)
    return points
  }

  // Every rule's check, the enemy units' last.
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
    const effect: Effect = { source, owner, holder, rule, weight: weight * share, reach }
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
      hexId: board.positions[board.units.indexOf(unit)]!,
      team: Team.ALLY,
      characterId: unit,
      skillManager: board.manager,
      lookups: board.lookups,
    }
  }

  // The team's heroes, the effect's holder left out, in the order of the rule's
  // list, or of the fallback list when the team has none of its own list's.
  private ranked(name: string, holder: number | undefined): number[] {
    const others = this.heroes.filter((hero) => hero !== holder)
    const order = this.list(name)!.filter((hero) => others.includes(hero))
    return order.length ? order : this.list(FALLBACK_LIST)!.filter((hero) => others.includes(hero))
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
    const self = holder === undefined ? undefined : identity(holder)
    const unitsOn = (hexIds: number[]): Set<number> => {
      const units = new Set<number>()
      for (const hexId of hexIds) {
        const tile = this.board.grid.getTileById(hexId)
        if (tile.characterId === undefined || tile.team !== Team.ALLY) continue
        const unit = identity(tile.characterId)
        if (unit !== self) units.add(unit)
      }
      return units
    }

    if (goal === 'none') return null
    if (goal === 'most' || 'most' in goal) {
      return effect.best ? this.countMarked(goal, marked, this.board) / effect.best : null
    }
    if ('atMost' in goal) return unitsOn(marked).size <= goal.atMost ? 1 : 0
    if ('exactly' in goal) {
      const on = [...unitsOn(marked)]
      if (on.length !== goal.exactly) return 0
      if (
        goal.sameFaction &&
        new Set(on.map((unit) => this.board.lookups.factionOf(unit))).size !== 1
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
      const count = Math.max(1, hit.size)
      return order.slice(0, count).filter((hero) => hit.has(hero)).length / count
    }
    // Include: a share for each listed hero among those it reaches, where a
    // single target needs only one of them.
    const slots = marked.length ? order.length : 1
    return Math.min(1, order.filter((hero) => hit.has(hero)).length / slots)
  }

  private held(rule: FormationRule): boolean {
    const { board } = this
    const tileOf = (hero: number) => board.positions[board.units.indexOf(hero)]!
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
    const depthOf = (hero: number) =>
      this.depth.get(this.board.positions[this.board.units.indexOf(hero)]!)!
    let lean = 0
    for (const hero of this.front) lean += depthOf(hero)
    for (const hero of this.back) lean += 1 - depthOf(hero)
    return lean
  }
}
