/* The Supreme League generator's choice: the set of five teams, one per map
 * and no hero twice, with the best chance to win three maps, for the heroes a
 * visitor selects at their levels, from the data file's recorded teams.
 *
 * A port of the external report generator's own chooser, which an audit there
 * runs beside this one on the same file, so the two must agree to the last
 * digit: keep each formula's order of arithmetic and each sort's tie order as
 * they are. The audit loads this file in Node by stripping its types, so it
 * imports types alone (`import type`) and nothing at run time. */

import type {
  SlBeforeTeam,
  SlChoice,
  SlChoiceTeam,
  SlData,
  SlEvidence,
  SlFamily,
  SlPick,
  SlSeason,
  SlTeam,
} from './types'

type Season = SlSeason<SlTeam | SlBeforeTeam>

interface Rated {
  won: boolean
  gap: number
  opponent: number
}

interface Judged {
  rate: number
  logit: number
  spread2: number
  wins: number
  losses: number
}

interface Option extends Judged {
  source: number
  team: number
  rank: number
  heroes: number[]
  family: number | null
  group: Judged
  players: number
  comp: [number, number, number] | null
  chance: number
}

const sigmoid = (x: number): number =>
  x >= 0 ? 1 / (1 + Math.exp(-x)) : Math.exp(x) / (1 + Math.exp(x))

// A team's chance at equal upgrades from its games, starting from `start` with
// `prior` notional games, by bisection on its log-odds.
function equalUpgradeRate(games: Rated[], theta: number, prior: number, start: number): number {
  const wins = games.filter((g) => g.won).length + prior * start
  let lo = -40
  let hi = 40
  for (let iter = 0; iter < 60; iter++) {
    const mid = (lo + hi) / 2
    const expected =
      prior * sigmoid(mid) +
      games.reduce((n, g) => n + sigmoid(mid + theta * g.gap - g.opponent), 0)
    if (expected < wins) lo = mid
    else hi = mid
  }
  return sigmoid((lo + hi) / 2)
}

const CELESTIAL_HYPOGEAN = ['celestial', 'hypogean']

function choose(
  data: SlData,
  sources: Season[],
  picked: ReadonlyMap<number, SlPick>,
): SlChoice | null {
  const { prior } = data
  const excluded = (id: number): boolean => !picked.has(id)
  const allowed = (heroes: number[]): boolean => !heroes.some(excluded)
  const position = new Map(data.order.map((id, i) => [id, i]))
  const before = (a: number, b: number): boolean => position.get(a)! < position.get(b)!

  // A team's upgrade gap in Rivalry points against an opponent whose heroes are
  // all at the top levels: what its heroes fall short of them.
  const shortfall = (id: number): number => {
    const pick = picked.get(id)!
    const paragon = data.prices.paragon[pick.faction]!
    const refinement = data.prices.refinement
    return (
      paragon[paragon.length - 1]! -
      paragon[pick.paragon]! +
      refinement[refinement.length - 1]! -
      refinement[pick.refinement]!
    )
  }
  const gap = (team: number[]): number => -team.reduce((n, id) => n + shortfall(id), 0)

  // The gap is priced at `data.prices`, which this season's effect was fitted
  // with, so it weighs the season before's teams too; each season's own effect
  // still reads its own games (judge).
  const { theta } = data
  // A swap's rate, moved by its upgrade gap alone.
  const shifted = (rate: number, heroes: number[]): number => {
    const points = gap(heroes)
    return points ? sigmoid(Math.log(rate / (1 - rate)) + theta * points) : rate
  }
  // A rate averaged over the spread of its log-odds (the probit approximation).
  const chanceOf = (t: Option): number =>
    sigmoid((t.logit + theta * gap(t.heroes)) / Math.sqrt(1 + (Math.PI * t.spread2) / 8))
  const rated = (s: Season, ids: number[]): Rated[] =>
    ids.map((i) => ({ won: s.games[i]![1] === 'w', gap: s.games[i]![2], opponent: s.games[i]![3] }))
  const slope = (x: number): number => sigmoid(x) * (1 - sigmoid(x))
  // Results start from `start` with the notional games; the estimate's
  // log-odds spread comes from its own games and from its start's, scaled by
  // how far the start moves it (the Laplace approximation of the fit).
  const judge = (s: Season, ids: number[], start: number, spread2: number): Judged => {
    const decided = ids.filter((i) => s.games[i]![1] !== 't')
    const games = rated(s, decided)
    const wins = decided.filter((i) => s.games[i]![1] === 'w').length
    const rate = equalUpgradeRate(games, s.theta, prior, start)
    const logit = Math.log(rate / (1 - rate))
    const information =
      games.reduce((n, g) => n + slope(logit + s.theta * g.gap - g.opponent), 0) +
      prior * slope(logit)
    const pull = (prior * start * (1 - start)) / information
    return {
      rate,
      logit,
      spread2: pull * pull * spread2 + 1 / information,
      wins,
      losses: decided.length - wins,
    }
  }
  const byChance = (a: Option, b: Option): number =>
    b.chance - a.chance || (a.rank < b.rank ? -1 : 1)

  // Each map's teams the selection allows, from each season, best first.
  const options = (proof: SlEvidence): Option[][] =>
    data.maps.map((_, map) =>
      sources
        .flatMap((s, source) => {
          const here: number[] = []
          s.games.forEach((g, i) => {
            const t = s.teams[g[0]]!
            if (t.map === map && allowed(t.heroes)) here.push(i)
          })
          const families: (number | null)[] = [
            ...s.families.keys(),
            ...(proof.oneOffs ? [null] : []),
          ]
          return families.flatMap((family) => {
            const mine = here.filter((i) => s.teams[s.games[i]![0]]!.family === family)
            const group =
              family === null
                ? judge(s, mine, s.oneOffStart, 0)
                : judge(s, mine, s.families[family]!.expected, s.families[family]!.spread ** 2)
            if (group.wins + group.losses < proof.groupGames) return []
            return [...new Set(mine.map((i) => s.games[i]![0]))]
              .map((team) => {
                const t = s.teams[team]!
                return {
                  source,
                  team,
                  rank: t.rank,
                  heroes: t.heroes,
                  family,
                  group,
                  players: t.players,
                  comp: family === null ? null : s.families[family]!.perMap[map]!,
                  ...judge(s, t.games, group.rate, group.spread2),
                  chance: 0,
                }
              })
              .filter(
                (t) =>
                  t.wins + t.losses >= 1 &&
                  (t.players >= proof.players || t.wins + t.losses >= proof.games),
              )
              .map((t) => ({ ...t, chance: chanceOf(t) }))
          })
        })
        .sort(byChance),
    )

  // The chance of winning each number of maps, each map won or lost on its own,
  // and of winning a majority of them.
  const needed = Math.floor(data.maps.length / 2) + 1
  const oddsOf = (chances: number[]): number[] => {
    let odds = [1]
    for (const p of chances) {
      const next = Array<number>(odds.length + 1).fill(0)
      odds.forEach((q, k) => {
        next[k]! += q * (1 - p)
        next[k + 1]! += q * p
      })
      odds = next
    }
    return odds
  }
  const matchChance = (chances: number[]): number =>
    oddsOf(chances)
      .slice(needed)
      .reduce((a, b) => a + b, 0)

  // A complete search, the map with the fewest teams first. The match chance
  // rises with each map's chance, so the best team left on each open map
  // bounds a branch, and since a map's teams come best first, the rest of that
  // map's teams can only do worse.
  const bestSet = (pools: Option[][]): { chance: number; teams: Option[] } | null => {
    const order = pools.map((_, i) => i).sort((a, b) => pools[a]!.length - pools[b]!.length)
    let best: { chance: number; teams: Option[] } | null = null
    const chosen: Option[] = []
    const walk = (depth: number, used: Set<number>): void => {
      if (depth === order.length) {
        const chance = matchChance(chosen.map((t) => t.chance))
        if (!best || chance > best.chance) best = { chance, teams: [...chosen] }
        return
      }
      for (const t of pools[order[depth]!]!) {
        if (t.heroes.some((h) => used.has(h))) continue
        chosen[order[depth]!] = t
        if (
          best &&
          matchChance(
            order.map((i, j) => (j <= depth ? chosen[i]!.chance : (pools[i]![0]?.chance ?? 0))),
          ) <= best.chance
        ) {
          break
        }
        walk(depth + 1, new Set([...used, ...t.heroes]))
      }
    }
    walk(0, new Set())
    return best
  }

  // One artifact for each of this season's teams and none twice: the
  // assignment whose teams used their artifacts most, each team weighing the
  // same, as the share of its boards that used each.
  const artifactsFor = (teams: Option[]): (number | null)[] => {
    const ranked = teams.map((t) => {
      const team = sources[t.source]!.teams[t.team]!
      return 'artifacts' in team ? team.artifacts : []
    })
    let best: { total: number; chosen: (number | null)[] } | null = null
    const walk = (i: number, used: Set<number>, total: number, chosen: (number | null)[]): void => {
      if (i === ranked.length) {
        if (!best || total > best.total) best = { total, chosen }
        return
      }
      for (const [id, share] of ranked[i]!) {
        if (!used.has(id)) walk(i + 1, new Set([...used, id]), total + share, [...chosen, id])
      }
      if (ranked[i]!.every(([id]) => used.has(id))) walk(i + 1, used, total, [...chosen, null])
    }
    walk(0, new Set(), 0, [])
    return best!.chosen
  }

  // The placement the team's board draws, as an example board is chosen: by
  // results times use to the power alpha, the team's results starting from its
  // group's strength (or for a team outside every group from its chance here),
  // and its placements' from the team's.
  const placement = (t: Option): number => {
    const s = sources[t.source]!
    const team = s.teams[t.team]!
    const start = equalUpgradeRate(
      rated(s, team.lineup),
      s.theta,
      prior,
      t.family === null ? t.group.rate : s.families[t.family]!.expected,
    )
    const ranked = team.placements
      .map((p, i) => {
        const rate = equalUpgradeRate(rated(s, p.games), s.theta, prior, start)
        return { ...p, i, rate, score: rate * p.use ** data.alpha }
      })
      .sort(
        (a, b) =>
          b.score - a.score ||
          b.players - a.players ||
          b.setups - a.setups ||
          b.agree - a.agree ||
          (a.order < b.order ? -1 : a.order > b.order ? 1 : 0),
      )
    return ranked[0]!.i
  }

  // Swaps: the group's recorded teams that differ from this one by a single
  // hero, by their chance, best first, leaving out a hero not selected or one
  // the set uses elsewhere. Core keeps the group's core heroes the team holds
  // that no swap replaces: one with a swap is listed under Flex even past its
  // limit, and the other swaps fill what that limit leaves.
  const coreAndFlex = (t: Option, set: Option[]): Pick<SlChoiceTeam, 'core' | 'flex' | 'pairs'> => {
    if (t.family === null) return { core: [], flex: [], pairs: [] }
    const family = sources[t.source]!.families[t.family]!
    const core = family.core.filter((id) => t.heroes.includes(id))
    const elsewhere = new Set(set.filter((o) => o !== t).flatMap((o) => o.heroes))
    const swaps = new Map<number, { hero: number; chance: number }[]>()
    for (const [team, rate] of family.swaps) {
      const added = team.filter((h) => !t.heroes.includes(h))
      const dropped = t.heroes.filter((h) => !team.includes(h))
      if (added.length !== 1 || dropped.length !== 1) continue
      const hero = added[0]!
      const out = dropped[0]!
      if (elsewhere.has(hero) || excluded(hero)) continue
      if (!swaps.has(out)) swaps.set(out, [])
      swaps.get(out)!.push({ hero, chance: shifted(rate, team) })
    }
    const all = [...swaps]
      .map(([out, found]) => {
        found.sort((a, b) => b.chance - a.chance || (before(a.hero, b.hero) ? -1 : 1))
        return {
          out,
          best: found[0]!.chance,
          options: found.slice(0, data.flex.options).map((o) => o.hero),
        }
      })
      .sort((a, b) => b.best - a.best || (before(a.out, b.out) ? -1 : 1))
    const moved = new Set(all.filter((s) => core.includes(s.out)))
    const others = all
      .filter((s) => !moved.has(s))
      .slice(0, Math.max(0, data.flex.heroes - moved.size))
    const shown = all.filter((s) => moved.has(s) || others.includes(s))
    return {
      core: core.filter((id) => !all.some((s) => s.out === id)),
      flex: shown.map(({ out, options }) => ({ out, options })),
      pairs: pairSwaps(t, family, elsewhere, core, shown),
    }
  }

  // Two-hero swaps: the group's recorded teams that differ from this one by two
  // heroes, neither of them core nor out in a one-hero swap shown, for the rows
  // the one-hero swaps leave. Each pair, and each pair it can take, is in name
  // order, and ties break by those names.
  const byOrder = (a: number, b: number): number => (before(a, b) ? -1 : before(b, a) ? 1 : 0)
  const pairOrder = (a: number[], b: number[]): number =>
    byOrder(a[0]!, b[0]!) || byOrder(a[1]!, b[1]!)
  const pairSwaps = (
    t: Option,
    family: SlFamily,
    elsewhere: Set<number>,
    core: number[],
    shown: { out: number }[],
  ): SlChoiceTeam['pairs'] => {
    const rows = data.flex.heroes - shown.length
    if (rows <= 0) return []
    const fixed = new Set([...core, ...shown.map((s) => s.out)])
    const byOut = new Map<
      string,
      { out: number[]; found: { heroes: number[]; chance: number }[] }
    >()
    for (const [team, rate] of family.swaps) {
      const added = team.filter((h) => !t.heroes.includes(h))
      const dropped = t.heroes.filter((h) => !team.includes(h))
      if (added.length !== 2 || dropped.length !== 2 || dropped.some((h) => fixed.has(h))) continue
      if (added.some((h) => elsewhere.has(h) || excluded(h))) continue
      const out = [...dropped].sort(byOrder)
      const key = out.join('/')
      if (!byOut.has(key)) byOut.set(key, { out, found: [] })
      byOut.get(key)!.found.push({ heroes: [...added].sort(byOrder), chance: shifted(rate, team) })
    }
    return [...byOut.values()]
      .map(({ out, found }) => {
        found.sort((a, b) => b.chance - a.chance || pairOrder(a.heroes, b.heroes))
        return {
          out,
          best: found[0]!.chance,
          options: found.slice(0, data.flex.options).map((o) => o.heroes),
        }
      })
      .sort((a, b) => b.best - a.best || pairOrder(a.out, b.out))
      .slice(0, rows)
      .map(({ out, options }) => ({ out, options }))
  }

  for (const [evidence, proof] of data.evidence.entries()) {
    const set = bestSet(options(proof))
    if (!set) continue
    const artifacts = artifactsFor(set.teams)
    return {
      evidence,
      chance: set.chance,
      odds: oddsOf(set.teams.map((t) => t.chance)),
      teams: set.teams.map((t, i) => ({
        source: t.source,
        team: t.team,
        heroes: t.heroes,
        family: t.family,
        rate: t.rate,
        chance: t.chance,
        comp: t.comp,
        artifact: artifacts[i]!,
        placement: placement(t),
        ...coreAndFlex(t, set.teams),
      })),
    }
  }
  return null
}

/* The set for `picks`, or null when none can be made. The season before's
 * teams join when the selection holds fewer than `beforeUnder` Celestial and
 * Hypogean heroes that some recorded team holds, or when this season's teams
 * alone make no set. Each of them takes, in map order, the first artifact it
 * can take that no team before it in the set has. */
export function chooseSlSet(data: SlData, picks: readonly SlPick[]): SlChoice | null {
  const picked = new Map(picks.map((pick) => [pick.id, pick]))
  const now: Season = data
  const { before, beforeUnder = 0 } = data
  if (!before) return choose(data, [now], picked)
  const held = new Set([...data.teams, ...before.teams].flatMap((t) => t.heroes))
  const rare = picks.filter(
    (pick) => CELESTIAL_HYPOGEAN.includes(pick.faction) && held.has(pick.id),
  ).length
  const set =
    rare < beforeUnder
      ? choose(data, [now, before], picked)
      : (choose(data, [now], picked) ?? choose(data, [now, before], picked))
  if (!set) return null
  const used = new Set(set.teams.flatMap((t) => (t.artifact === null ? [] : [t.artifact])))
  for (const t of set.teams) {
    if (t.source === 0) continue
    t.artifact = before.teams[t.team]!.like.find((id) => !used.has(id)) ?? null
    if (t.artifact !== null) used.add(t.artifact)
  }
  return set
}
