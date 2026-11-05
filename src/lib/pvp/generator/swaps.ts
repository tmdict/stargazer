/* The swaps shown under a chosen team's board. */

import type { SlData, SlFamily } from '../data/types'
import type { SlChoiceTeam } from './types'

interface SwapRules {
  family: SlFamily
  // The chance of a recorded team of the family at the visitor's levels.
  chanceOf: (heroes: number[]) => number
  excluded: (id: number) => boolean
  // Whether a recorded team has an ally tile on the board for each of its units.
  stands: (heroes: number[]) => boolean
  // Ties break in the order of the heroes' English names.
  before: (a: number, b: number) => boolean
  flex: SlData['flex']
}

/* Swaps: the group's recorded teams that differ from this one by a single
 * hero, by their chance, best first, leaving out a hero not selected, one the
 * set uses elsewhere, and a team the board has too few ally tiles for. Core
 * keeps the group's core heroes the team holds that no swap replaces: one with
 * a swap is listed under Flex even past its limit, and the other swaps fill
 * what that limit leaves. */
export function swapsOf(
  heroes: number[],
  elsewhere: ReadonlySet<number>,
  rules: SwapRules,
): Pick<SlChoiceTeam, 'core' | 'flex' | 'pairs'> {
  const { family, chanceOf, excluded, stands, before, flex } = rules
  const core = family.core.filter((id) => heroes.includes(id))
  const swaps = new Map<number, { hero: number; chance: number }[]>()
  for (const team of family.swaps) {
    const added = team.filter((h) => !heroes.includes(h))
    const dropped = heroes.filter((h) => !team.includes(h))
    if (added.length !== 1 || dropped.length !== 1) continue
    const hero = added[0]!
    const out = dropped[0]!
    if (elsewhere.has(hero) || excluded(hero) || !stands(team)) continue
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
  { family, chanceOf, excluded, stands, before, flex }: SwapRules,
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
    if (added.some((h) => elsewhere.has(h) || excluded(h)) || !stands(team)) continue
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
