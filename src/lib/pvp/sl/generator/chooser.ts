/* The Supreme League generator's choice: the set of recorded teams, one per
 * board and no hero twice, each with an artifact by the artifact rule, with
 * the best chance to win most of the boards, for the heroes a visitor selects
 * at their levels. A board takes the teams recorded on its map: the file's
 * maps in order give a Supreme League set, the same map on every board a set
 * for the Teams page's default 5v5 maps. Each team's chance is the model's,
 * against a typical opponent at the top levels.
 *
 * The external report generator's check loads this file in Node by stripping
 * its types, so it and what it imports use relative imports ending in .ts and
 * nothing of the browser. */

import type { SlData, SlEvidence } from '../data/types.ts'
import { shortfall } from '../data/upgrades.ts'
import { sigmoid } from '../model/fit.ts'
import type { SlLearned } from '../model/models.ts'
import { artifactClaims, handOutArtifacts, type ArtifactClaim } from './artifacts.ts'
import { placementOf, swapsOf } from './boards.ts'
import type { SlChoice, SlPick } from './types.ts'

const CELESTIAL_HYPOGEAN = ['celestial', 'hypogean']

interface Option {
  source: number
  team: number
  map: number
  rank: number
  heroes: number[]
  family: number | null
  kind: number | null
  claim: ArtifactClaim
  chanceWith: (artifact: number | null) => number
  // The best chance any artifact it can end up with gives it.
  best: number
}

interface Found {
  chance: number
  teams: Option[]
  artifacts: (number | null)[]
  chances: number[]
}

// The chance of winning each number of boards, each board won or lost on its own.
// Written in place, since the search asks for it at every step.
function oddsInto(chances: ArrayLike<number>, odds: Float64Array): Float64Array {
  odds.fill(0)
  odds[0] = 1
  for (let i = 0; i < chances.length; i++) {
    const p = chances[i]!
    for (let k = i + 1; k > 0; k--) odds[k] = odds[k - 1]! * p + odds[k]! * (1 - p)
    odds[0] = odds[0]! * (1 - p)
  }
  return odds
}

function choose(
  data: SlData,
  learned: SlLearned,
  sources: number[],
  picked: ReadonlyMap<number, SlPick>,
  counts: (artifact: number) => boolean,
  boards: readonly number[],
): SlChoice | null {
  const { model, kindOf } = learned
  const excluded = (id: number): boolean => !picked.has(id)
  const gap = (heroes: number[]): number =>
    -heroes.reduce((n, id) => n + shortfall(data.prices, picked.get(id)!), 0)
  const claimOf = artifactClaims(data)
  const needed = Math.floor(boards.length / 2) + 1
  const odds = new Float64Array(boards.length + 1)
  const matchChance = (chances: ArrayLike<number>): number => {
    oddsInto(chances, odds)
    let sum = 0
    for (let k = needed; k < odds.length; k++) sum += odds[k]!
    return sum
  }

  // Each board's teams the selection allows with the evidence asked, from
  // each season, the best first. Boards on one map share one pool, which the
  // search relies on.
  const optionsFor = (proof: SlEvidence): Option[][] => {
    const pools = new Map<number, Option[]>()
    return boards.map((map) => {
      if (pools.has(map)) return pools.get(map)!
      const found: Option[] = []
      for (const source of sources) {
        const s = source === 0 ? data : data.before!
        const decided = (ids: number[]): number => ids.filter((i) => s.games[i]![1] !== 't').length
        const byFamily = new Map<number | null, number[]>()
        s.games.forEach(([team], i) => {
          const t = s.teams[team]!
          if (t.map !== map || t.heroes.some(excluded)) return
          if (!byFamily.has(t.family)) byFamily.set(t.family, [])
          byFamily.get(t.family)!.push(i)
        })
        for (const [family, ids] of byFamily) {
          if (family === null && !proof.oneOffs) continue
          if (decided(ids) < proof.groupGames) continue
          for (const team of new Set(ids.map((i) => s.games[i]![0]))) {
            const t = s.teams[team]!
            const n = decided(t.games)
            if (n < 1 || !(t.players >= proof.players || n >= proof.games)) continue
            const kind = source === 0 ? t.family : kindOf(t.heroes)
            const claim = claimOf(source, team, kind)
            const points = gap(t.heroes)
            const cache = new Map<number | null, number>()
            const chanceWith = (artifact: number | null): number => {
              if (!cache.has(artifact)) {
                const counted = artifact !== null && counts(artifact) ? artifact : null
                const side = { heroes: t.heroes, kind, artifact: counted }
                cache.set(artifact, sigmoid(model.againstTypical(side, points)))
              }
              return cache.get(artifact)!
            }
            const reachable: (number | null)[] = [
              ...claim.own.map((o) => o.id),
              ...claim.fallback.slice(0, boards.length),
            ]
            // The other teams hold one artifact each at most.
            if (reachable.length < boards.length) reachable.push(null)
            const best = Math.max(...reachable.map(chanceWith))
            found.push({
              source,
              team,
              map,
              rank: t.rank,
              heroes: t.heroes,
              family,
              kind,
              claim,
              chanceWith,
              best,
            })
          }
        }
      }
      found.sort((a, b) => b.best - a.best || a.rank - b.rank)
      pools.set(map, found)
      return found
    })
  }

  // A complete search, the board with the fewest teams first. The match
  // chance rises with each board's chance, so a branch is bounded by its
  // teams' best chances and, on each open board, the best chance of the first
  // team that still fits. A board's teams come best first, so once one falls
  // short, the rest of that board's teams do too. Boards sharing a pool take
  // its teams in pool order, so the same teams are never tried again in
  // another order; on such boards an artifact tie goes to the better team.
  const bestSet = (pools: Option[][]): Found | null => {
    if (pools.some((pool) => !pool.length)) return null
    const n = pools.length
    const order = pools.map((_, i) => i).sort((a, b) => pools[a]!.length - pools[b]!.length)
    const byDepth = order.map((i) => pools[i]!)
    let best: Found | null = null
    const chosen: Option[] = []
    const used = new Uint8Array(Math.max(...pools.flat().flatMap((t) => t.heroes)) + 1)
    const fits = (t: Option): boolean => !t.heroes.some((h) => used[h])
    // first[d][j]: the first team of depth j's pool that fits beside the teams
    // chosen above depth d. Teams only join on the way down, so it only moves
    // forward.
    const first = Array.from({ length: n + 1 }, () => new Int32Array(n))
    const bound = new Float64Array(n)
    // The depth above with the same pool (-1 for none), and the team taken at
    // each depth.
    const twin = byDepth.map((pool, d) => byDepth.slice(0, d).lastIndexOf(pool))
    const taken = new Int32Array(n)
    const boundFrom = (d: number, open: Int32Array): number => {
      for (let j = d + 1; j < n; j++) bound[j] = byDepth[j]![open[j]!]!.best
      return matchChance(bound)
    }
    const settle = (): void => {
      const artifacts = handOutArtifacts(chosen.map((t) => t.claim))
      const chances = chosen.map((t, i) => t.chanceWith(artifacts[i] ?? null))
      const chance = matchChance(chances)
      if (!best || chance > best.chance) best = { chance, teams: [...chosen], artifacts, chances }
    }
    const walk = (d: number): void => {
      if (d === n) return settle()
      const pool = byDepth[d]!
      const here = first[d]!
      const next = first[d + 1]!
      const after = twin[d]! < 0 ? 0 : taken[twin[d]!]! + 1
      for (let k = Math.max(here[d]!, after); k < pool.length; k++) {
        const t = pool[k]!
        if (!fits(t)) continue
        bound[d] = t.best
        if (best && boundFrom(d, here) <= best.chance) break
        for (const h of t.heroes) used[h] = 1
        let open = true
        for (let j = d + 1; j < n && open; j++) {
          const later = byDepth[j]!
          let i = here[j]!
          while (i < later.length && !fits(later[i]!)) i++
          next[j] = i
          open = i < later.length
        }
        if (open && (!best || boundFrom(d, next) > best.chance)) {
          taken[d] = k
          chosen[order[d]!] = t
          walk(d + 1)
        }
        for (const h of t.heroes) used[h] = 0
      }
    }
    walk(0)
    return best
  }

  const position = new Map(data.order.map((id, i) => [id, i]))
  const before = (a: number, b: number): boolean => position.get(a)! < position.get(b)!

  for (const proof of data.evidence) {
    const set = bestSet(optionsFor(proof))
    if (!set) continue
    return {
      chance: set.chance,
      odds: [...oddsInto(set.chances, new Float64Array(boards.length + 1))],
      teams: set.teams.map((t, i) => {
        const s = t.source === 0 ? data : data.before!
        const artifact = set.artifacts[i] ?? null
        const counted = artifact !== null && counts(artifact) ? artifact : null
        const elsewhere = new Set(set.teams.filter((o) => o !== t).flatMap((o) => o.heroes))
        const swaps =
          t.family === null
            ? { core: [], flex: [], pairs: [] }
            : swapsOf(t.heroes, elsewhere, {
                family: s.families[t.family]!,
                chanceOf: (heroes) =>
                  sigmoid(
                    model.againstTypical(
                      { heroes, kind: t.source === 0 ? t.family : kindOf(heroes), artifact: null },
                      gap(heroes),
                    ),
                  ),
                excluded,
                before,
                flex: data.flex,
              })
        return {
          source: t.source,
          team: t.team,
          heroes: t.heroes,
          family: t.family,
          chance: set.chances[i]!,
          comp: t.family === null ? null : s.families[t.family]!.perMap[t.map]!,
          artifact,
          placement: placementOf(data, learned, t.source, t.team, counted),
          ...swaps,
        }
      }),
    }
  }
  return null
}

/* The set for `picks`, or null when none can be made. `boards` holds each
 * board's map, an index into the file's maps. The season before's teams join
 * when the selection holds fewer than `beforeUnder` Celestial and Hypogean
 * heroes that some recorded team holds, or when this season's teams alone
 * make no set. `counts` says whether an artifact counts toward a
 * chance: after a season change the file's seasonal artifacts are out of the
 * game, so the set still hands them out and counts them as typical ones. */
export function chooseSlSet(
  data: SlData,
  learned: SlLearned,
  picks: readonly SlPick[],
  counts: (artifact: number) => boolean = () => true,
  boards: readonly number[] = data.maps.map((_, i) => i),
): SlChoice | null {
  const picked = new Map(picks.map((pick) => [pick.id, pick]))
  const { before, beforeUnder = 0 } = data
  const chooseFrom = (sources: number[]) => choose(data, learned, sources, picked, counts, boards)
  if (!before) return chooseFrom([0])
  const held = new Set([...data.teams, ...before.teams].flatMap((t) => t.heroes))
  const rare = picks.filter(
    (pick) => CELESTIAL_HYPOGEAN.includes(pick.faction) && held.has(pick.id),
  ).length
  return rare < beforeUnder ? chooseFrom([0, 1]) : (chooseFrom([0]) ?? chooseFrom([0, 1]))
}
