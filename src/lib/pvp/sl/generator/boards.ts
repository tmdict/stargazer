/* The board drawn for a chosen team and the swaps shown under it. */

import type { Side } from '../data/games.ts'
import type { SlData, SlFamily } from '../data/types.ts'
import { sigmoid } from '../model/fit.ts'
import type { SlLearned } from '../model/models.ts'
import type { SlChoiceTeam } from './types.ts'

// A rate from decided games, starting from `start` with `prior` notional
// games, by bisection on its log-odds. Each game's offset is how much easier
// than a typical opponent at equal upgrades it was.
function rateFrom(games: { won: boolean; offset: number }[], prior: number, start: number): number {
  const wins = games.filter((g) => g.won).length + prior * start
  let lo = -40
  let hi = 40
  for (let step = 0; step < 60; step++) {
    const mid = (lo + hi) / 2
    const expected = prior * sigmoid(mid) + games.reduce((n, g) => n + sigmoid(mid + g.offset), 0)
    if (expected < wins) lo = mid
    else hi = mid
  }
  return sigmoid((lo + hi) / 2)
}

/* The placement the team's board draws, as an example board is chosen. A
 * placement's results start from the team's chance with `artifact` against a
 * typical opponent at equal upgrades, and the model weighs each game by its
 * opponent and the artifact the team played, so a placement gains nothing
 * from games won on a stronger artifact than the set gives. */
export function placementOf(
  data: SlData,
  { model, kindOf }: SlLearned,
  source: number,
  team: number,
  artifact: number | null,
): number {
  const sideOf = (i: number): Side => {
    if (source === 0) {
      const [t, , , used] = data.games[i]!
      return { heroes: data.teams[t]!.heroes, kind: data.teams[t]!.family, artifact: used }
    }
    const heroes = data.before!.teams[data.before!.games[i]![0]]!.heroes
    return { heroes, kind: kindOf(heroes), artifact: null }
  }
  const season = source === 0 ? data : data.before!
  const { heroes, family } = season.teams[team]!
  const own: Side = { heroes, kind: source === 0 ? family : kindOf(heroes), artifact }
  const alone = model.againstTypical(own, 0)
  const rated = (ids: number[]) =>
    ids.map((i) => {
      const [, result, gap] = season.games[i]!
      // Last season's games carry no artifact, so its teams count as playing
      // with `artifact`. Entries 2k and 2k + 1 are one game.
      const played = source === 0 ? sideOf(i) : own
      const offset = model.edge({ a: played, b: sideOf(i ^ 1), gap }) - alone
      return { won: result === 'w', offset }
    })
  const ranked = season.teams[team]!.placements.map((p, i) => {
    const rate = rateFrom(rated(p.games), data.prior, sigmoid(alone))
    return { ...p, i, score: rate * p.use ** data.alpha }
  })
  ranked.sort(
    (a, b) =>
      b.score - a.score ||
      b.players - a.players ||
      b.setups - a.setups ||
      b.agree - a.agree ||
      a.order - b.order,
  )
  return ranked[0]!.i
}

interface SwapRules {
  family: SlFamily
  // The chance of a recorded team of the family at the visitor's levels.
  chanceOf: (heroes: number[]) => number
  excluded: (id: number) => boolean
  // Ties break in the order of the heroes' English names.
  before: (a: number, b: number) => boolean
  flex: SlData['flex']
}

/* Swaps: the group's recorded teams that differ from this one by a single
 * hero, by their chance, best first, leaving out a hero not selected or one
 * the set uses elsewhere. Core keeps the group's core heroes the team holds
 * that no swap replaces: one with a swap is listed under Flex even past its
 * limit, and the other swaps fill what that limit leaves. */
export function swapsOf(
  heroes: number[],
  elsewhere: ReadonlySet<number>,
  rules: SwapRules,
): Pick<SlChoiceTeam, 'core' | 'flex' | 'pairs'> {
  const { family, chanceOf, excluded, before, flex } = rules
  const core = family.core.filter((id) => heroes.includes(id))
  const swaps = new Map<number, { hero: number; chance: number }[]>()
  for (const team of family.swaps) {
    const added = team.filter((h) => !heroes.includes(h))
    const dropped = heroes.filter((h) => !team.includes(h))
    if (added.length !== 1 || dropped.length !== 1) continue
    const hero = added[0]!
    const out = dropped[0]!
    if (elsewhere.has(hero) || excluded(hero)) continue
    if (!swaps.has(out)) swaps.set(out, [])
    swaps.get(out)!.push({ hero, chance: chanceOf(team) })
  }
  const all = [...swaps]
    .map(([out, found]) => {
      found.sort((a, b) => b.chance - a.chance || (before(a.hero, b.hero) ? -1 : 1))
      return {
        out,
        best: found[0]!.chance,
        options: found.slice(0, flex.options).map((o) => o.hero),
      }
    })
    .sort((a, b) => b.best - a.best || (before(a.out, b.out) ? -1 : 1))
  const moved = new Set(all.filter((s) => core.includes(s.out)))
  const others = all.filter((s) => !moved.has(s)).slice(0, Math.max(0, flex.heroes - moved.size))
  const shown = all.filter((s) => moved.has(s) || others.includes(s))
  return {
    core: core.filter((id) => !all.some((s) => s.out === id)),
    flex: shown.map(({ out, options }) => ({ out, options })),
    pairs: pairSwaps(heroes, elsewhere, rules, core, shown),
  }
}

/* Two-hero swaps: the group's recorded teams that differ from this one by two
 * heroes, neither of them core nor out in a one-hero swap shown, for the rows
 * the one-hero swaps leave. Each pair, and each pair it can take, is in name
 * order, and ties break by those names. */
function pairSwaps(
  heroes: number[],
  elsewhere: ReadonlySet<number>,
  { family, chanceOf, excluded, before, flex }: SwapRules,
  core: number[],
  shown: { out: number }[],
): SlChoiceTeam['pairs'] {
  const rows = flex.heroes - shown.length
  if (rows <= 0) return []
  const byOrder = (a: number, b: number): number => (before(a, b) ? -1 : before(b, a) ? 1 : 0)
  const pairOrder = (a: number[], b: number[]): number =>
    byOrder(a[0]!, b[0]!) || byOrder(a[1]!, b[1]!)
  const fixed = new Set([...core, ...shown.map((s) => s.out)])
  const byOut = new Map<string, { out: number[]; found: { heroes: number[]; chance: number }[] }>()
  for (const team of family.swaps) {
    const added = team.filter((h) => !heroes.includes(h))
    const dropped = heroes.filter((h) => !team.includes(h))
    if (added.length !== 2 || dropped.length !== 2 || dropped.some((h) => fixed.has(h))) continue
    if (added.some((h) => elsewhere.has(h) || excluded(h))) continue
    const out = [...dropped].sort(byOrder)
    const key = out.join('/')
    if (!byOut.has(key)) byOut.set(key, { out, found: [] })
    byOut.get(key)!.found.push({ heroes: [...added].sort(byOrder), chance: chanceOf(team) })
  }
  return [...byOut.values()]
    .map(({ out, found }) => {
      found.sort((a, b) => b.chance - a.chance || pairOrder(a.heroes, b.heroes))
      return {
        out,
        best: found[0]!.chance,
        options: found.slice(0, flex.options).map((o) => o.heroes),
      }
    })
    .sort((a, b) => b.best - a.best || pairOrder(a.out, b.out))
    .slice(0, rows)
    .map(({ out, options }) => ({ out, options }))
}
