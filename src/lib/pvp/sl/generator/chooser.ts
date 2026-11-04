/* The PvP team generator's choice: the set of recorded teams, one per
 * board and no hero twice, each with an artifact by the artifact rule, with
 * the best chance to win most of the boards, for the heroes a visitor selects
 * at their levels. A board takes the teams recorded on its map, or on a map
 * with no records those of every map (boardTeams), and boards on one map share
 * them. Each team's chance is the model's, against a typical opponent at the
 * top levels, with its odds scaled by the share of its own effects its board's
 * map leaves it (fit.ts). */

import { lineupKey } from '../data/sides'
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
  // Its chance on the board at that index with the artifact, or -1 on a board
  // whose map has no tile for each of its units.
  chanceOn: (board: number, artifact: number | null) => number
  // The best chance any artifact it can end up with gives it on any board
  // its pool serves.
  best: number
  // Measures the team's fit on the board at that index once, and says whether
  // that lowered its chance there.
  refit: (board: number) => boolean
}

interface Found {
  chance: number
  teams: Option[]
  artifacts: (number | null)[]
  chances: number[]
}

const byBest = (a: Option, b: Option): number => b.best - a.best || a.rank - b.rank

const permutations = (n: number): number[][] =>
  n === 0
    ? [[]]
    : permutations(n - 1).flatMap((rest) =>
        Array.from({ length: n }, (_, at) => [...rest.slice(0, at), n - 1, ...rest.slice(at)]),
      )

// A season's teams a board takes, by index: those recorded on its map, or on a
// map with no records one per lineup from every map, the record with the most
// games with a winner, the better rank on a tie.
function boardTeams(
  teams: readonly { map: number; heroes: number[]; decided: number; rank: number }[],
  source: number | null,
): number[] {
  if (source !== null) return teams.flatMap((t, i) => (t.map === source ? [i] : []))
  const best = new Map<string, number>()
  teams.forEach((t, i) => {
    const lineup = lineupKey(t.heroes)
    const held = best.get(lineup)
    const other = held === undefined ? undefined : teams[held]!
    if (
      !other ||
      t.decided > other.decided ||
      (t.decided === other.decided && t.rank < other.rank)
    ) {
      best.set(lineup, i)
    }
  })
  return [...best.values()].sort((a, b) => a - b)
}

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

  // Boards that take the same teams share one pool, which the search relies
  // on: the boards on one recorded map, and every board on a map with no
  // records, where a team's chance differs from map to map only by its fit.
  const poolOf = (board: SlBoard): string | null =>
    board.source === null ? null : board.layout.key
  const unrecorded = boards.flatMap((board, i) => (board.source === null ? [i] : []))
  const trades = new Set(unrecorded.map((i) => boards[i]!.layout.key)).size > 1
  const reorders = trades ? permutations(unrecorded.length) : []

  // Each board's teams the selection allows with the evidence asked, from
  // each season, the best first.
  const optionsFor = (proof: SlEvidence): Option[][] => {
    const pools = new Map<string | null, Option[]>()
    return boards.map((board) => {
      const key = poolOf(board)
      if (pools.has(key)) return pools.get(key)!
      const served = new Map(
        boards.filter((b) => poolOf(b) === key).map((b) => [b.layout.key, b] as const),
      )
      const found: Option[] = []
      for (const source of sources) {
        const s = source === 0 ? data : data.before!
        const byFamily = new Map<number | null, number[]>()
        for (const team of boardTeams(s.teams, board.source)) {
          const t = s.teams[team]!
          if (t.heroes.some(excluded)) continue
          if (!byFamily.has(t.family)) byFamily.set(t.family, [])
          byFamily.get(t.family)!.push(team)
        }
        for (const [family, teams] of byFamily) {
          if (family === null && !proof.oneOffs) continue
          if (teams.reduce((n, i) => n + s.teams[i]!.decided, 0) < proof.groupGames) continue
          for (const team of teams) {
            const t = s.teams[team]!
            const n = t.decided
            if (n < 1 || !(t.players >= proof.players || n >= proof.games)) continue
            // The team's share on each map it stands on, by map.
            const shares = new Map<string, number | undefined>()
            for (const [layout, b] of served) {
              if (fit.stands(b, t.heroes)) shares.set(layout, fit.known(b, t.heroes, t.map))
            }
            if (!shares.size) continue
            const kind = source === 0 ? t.family : kindOf(t.heroes)
            const claim = claimOf(source, team, kind)
            const points = gap(t.heroes)
            const cache = new Map<string, number>()
            const chanceAt = (share: number | undefined, artifact: number | null): number => {
              const key = `${share}|${artifact}`
              let chance = cache.get(key)
              if (chance === undefined) {
                const counted = artifact !== null && counts(artifact) ? artifact : null
                const side = { heroes: t.heroes, kind, artifact: counted }
                chance = boardChance(model, side, points, share)
                cache.set(key, chance)
              }
              return chance
            }
            const reachable: (number | null)[] = [
              ...claim.own.map((o) => o.id),
              ...claim.fallback.slice(0, boards.length),
            ]
            // The other teams hold one artifact each at most.
            if (reachable.length < boards.length) reachable.push(null)
            const bestNow = (): number =>
              Math.max(
                ...[...shares.values()].flatMap((share) =>
                  reachable.map((a) => chanceAt(share, a)),
                ),
              )
            const option: Option = {
              source,
              team,
              map: t.map,
              rank: t.rank,
              heroes: t.heroes,
              family,
              kind,
              claim,
              chanceOn: (i, artifact) => {
                const layout = boards[i]!.layout.key
                return shares.has(layout) ? chanceAt(shares.get(layout), artifact) : -1
              },
              best: bestNow(),
              refit: (i) => {
                const layout = boards[i]!.layout.key
                if (shares.get(layout) !== undefined) return false
                const share = fit.measure(boards[i]!, t.heroes, t.map)
                shares.set(layout, share)
                if (share === 1) return false
                option.best = bestNow()
                return true
              },
            }
            found.push(option)
          }
        }
      }
      found.sort(byBest)
      pools.set(key, found)
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
  // Teams on maps with no records then trade boards, keeping their artifacts,
  // where that raises the match chance.
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
    // chosen above depth d, and comes after those its pool gave them. Teams
    // only join on the way down, so it only moves forward.
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
      const handed = handOutArtifacts(chosen.map((t) => t.claim))
      const alike = unrecorded.every((i) => {
        const here = chosen[i]!.chanceOn(i, handed[i] ?? null)
        return unrecorded.every((j) => chosen[i]!.chanceOn(j, handed[i] ?? null) === here)
      })
      for (const order of !trades || alike ? [null] : reorders) {
        const teams = [...chosen]
        const artifacts = [...handed]
        order?.forEach((from, k) => {
          teams[unrecorded[k]!] = chosen[unrecorded[from]!]!
          artifacts[unrecorded[k]!] = handed[unrecorded[from]!] ?? null
        })
        const chances = teams.map((t, i) => t.chanceOn(i, artifacts[i] ?? null))
        if (chances.some((chance) => chance < 0)) continue
        const chance = matchChance(chances)
        if (!best || chance > best.chance) best = { chance, teams, artifacts, chances }
      }
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
          let i = later === pool ? Math.max(here[j]!, k + 1) : here[j]!
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
    while (set?.teams.map((t, i) => t.refit(i)).some(Boolean)) {
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
