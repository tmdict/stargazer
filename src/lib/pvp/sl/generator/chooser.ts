/* The PvP team generator's choice: the set of recorded teams, one per
 * board and no hero twice, each with an artifact by the artifact rule, with
 * the best chance to win most of the boards, for the heroes a visitor selects
 * at their levels. A board takes the teams recorded on one of the file's maps
 * (slBoards), and boards on one map share them. Each team's chance is the
 * model's, against a typical opponent at the top levels, with its odds scaled
 * by the share of its own effects its board's map leaves it (fit.ts). */

import type { SlData, SlEvidence } from '../data/types'
import { oddsInto, winsNeeded } from '../model/odds'
import type { SlReader } from '../model/reader'
import { artifactClaims, handOutArtifacts, type ArtifactClaim } from './artifacts'
import { boardChance, levelGap } from './chance'
import { slFit, type SlFit } from './fit'
import type { SlBoard } from './setType'
import { swapsOf } from './swaps'
import type { SlChoice, SlPick } from './types'

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
  // Measures the team's fit once, and says whether that lowered its chances.
  refit: () => boolean
}

interface Found {
  chance: number
  teams: Option[]
  artifacts: (number | null)[]
  chances: number[]
}

const byBest = (a: Option, b: Option): number => b.best - a.best || a.rank - b.rank

function choose(
  data: SlData,
  { model, kindOf }: SlReader,
  sources: number[],
  picked: ReadonlyMap<number, SlPick>,
  counts: (artifact: number) => boolean,
  boards: readonly SlBoard[],
  fit: SlFit,
): SlChoice | null {
  const excluded = (id: number): boolean => !picked.has(id)
  const gap = (heroes: number[]): number => levelGap(data.prices, picked, heroes)
  const claimOf = artifactClaims(data)
  const needed = winsNeeded(boards.length)
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
    return boards.map((board) => {
      const map = board.source
      if (pools.has(map)) return pools.get(map)!
      const found: Option[] = []
      for (const source of sources) {
        const s = source === 0 ? data : data.before!
        const byFamily = new Map<number | null, number[]>()
        s.teams.forEach((t, team) => {
          if (t.map !== map || t.heroes.some(excluded)) return
          if (!byFamily.has(t.family)) byFamily.set(t.family, [])
          byFamily.get(t.family)!.push(team)
        })
        for (const [family, teams] of byFamily) {
          if (family === null && !proof.oneOffs) continue
          if (teams.reduce((n, i) => n + s.teams[i]!.decided, 0) < proof.groupGames) continue
          for (const team of teams) {
            const t = s.teams[team]!
            const n = t.decided
            if (n < 1 || !(t.players >= proof.players || n >= proof.games)) continue
            const kind = source === 0 ? t.family : kindOf(t.heroes)
            const claim = claimOf(source, team, kind)
            const points = gap(t.heroes)
            let share = fit.known(board, t.heroes)
            const cache = new Map<number | null, number>()
            const chanceWith = (artifact: number | null): number => {
              if (!cache.has(artifact)) {
                const counted = artifact !== null && counts(artifact) ? artifact : null
                const side = { heroes: t.heroes, kind, artifact: counted }
                cache.set(artifact, boardChance(model, side, points, share))
              }
              return cache.get(artifact)!
            }
            const reachable: (number | null)[] = [
              ...claim.own.map((o) => o.id),
              ...claim.fallback.slice(0, boards.length),
            ]
            // The other teams hold one artifact each at most.
            if (reachable.length < boards.length) reachable.push(null)
            const option: Option = {
              source,
              team,
              map,
              rank: t.rank,
              heroes: t.heroes,
              family,
              kind,
              claim,
              chanceWith,
              best: Math.max(...reachable.map(chanceWith)),
              refit: () => {
                if (share !== undefined) return false
                share = fit.measure(board, t.heroes)
                if (share === 1) return false
                cache.clear()
                option.best = Math.max(...reachable.map(chanceWith))
                return true
              },
            }
            found.push(option)
          }
        }
      }
      found.sort(byBest)
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
    const pools = optionsFor(proof)
    let set = bestSet(pools)
    // Every chance counts the fit of a team not yet measured at its most, so
    // once a set's teams are all measured, no other set can beat it. Placing a
    // team is slow, so only the teams a search picks are measured.
    while (set?.teams.map((t) => t.refit()).some(Boolean)) {
      for (const pool of new Set(pools)) pool.sort(byBest)
      set = bestSet(pools)
    }
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
                  boardChance(
                    model,
                    { heroes, kind: t.source === 0 ? t.family : kindOf(heroes), artifact: null },
                    gap(heroes),
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
          placement: s.teams[t.team]!.pick?.find(([a]) => a === counted)?.[1] ?? 0,
          ...swaps,
        }
      }),
    }
  }
  return null
}

/* The set for `picks`, or null when none can be made, on `boards` as slBoards
 * gives them. The season before's teams join when the selection holds fewer
 * than `beforeUnder` Celestial and Hypogean heroes that some recorded team
 * holds, or when this season's teams alone make no set. `counts` says whether
 * an artifact counts toward a chance: after a season change the file's
 * seasonal artifacts are out of the game, so the set still hands them out and
 * counts them as typical ones. `fit` keeps the fits it measures for the next
 * call. */
export function chooseSlSet(
  data: SlData,
  reader: SlReader,
  picks: readonly SlPick[],
  counts: (artifact: number) => boolean,
  boards: readonly SlBoard[],
  fit: SlFit = slFit(data),
): SlChoice | null {
  const picked = new Map(picks.map((pick) => [pick.id, pick]))
  const { before, beforeUnder = 0 } = data
  const chooseFrom = (sources: number[]) =>
    choose(data, reader, sources, picked, counts, boards, fit)
  if (!before) return chooseFrom([0])
  const held = new Set([...data.teams, ...before.teams].flatMap((t) => t.heroes))
  const rare = picks.filter(
    (pick) => CELESTIAL_HYPOGEAN.includes(pick.faction) && held.has(pick.id),
  ).length
  return rare < beforeUnder ? chooseFrom([0, 1]) : (chooseFrom([0]) ?? chooseFrom([0, 1]))
}
