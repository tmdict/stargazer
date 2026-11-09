/* The PvP team generator's choice: the set of recorded teams, one per board
 * and no hero twice, each with an artifact by the artifact rule, with the best
 * chance to win most of the boards, for the heroes a visitor selects at their
 * levels. A board takes the teams recorded on its map in every season, and
 * boards on one map share them. A board on a map with no records, or whose
 * map's teams make no set even under the relaxed rule, takes each lineup's
 * record over every map instead. Each team's chance is the model's, against a
 * typical opponent at the top levels, with its odds scaled by the share of its
 * own effects its board's map leaves it (fit.ts). */

import type { SlData, SlEvidence, SlRecord, SlTeam } from '../data/types'
import { oddsInto, winsNeeded } from '../model/odds'
import type { SlReader } from '../model/reader'
import { artifactClaims, handOutArtifacts, type ArtifactClaim } from './artifacts'
import { boardChance, levelGap } from './chance'
import { slFit, type SlFit, type SlFitRequest } from './fit'
import type { SlBoard } from './setType'
import { swapsOf } from './swaps'
import type { SlChoice, SlPick } from './types'

// The evidence counts are sums of weighted games and players, so one that
// adds up to a minimum can fall short of it by a rounding error.
const MARGIN = 1e-6
const meets = (count: number, minimum: number): boolean => count + MARGIN >= minimum

// Far above the rounding of a match chance summed in another order.
const ROUNDING = 1e-12

interface Option {
  // Where it comes from, as SlChoiceTeam says.
  source: number | null
  team: number
  rank: number
  heroes: number[]
  family: number | null
  claim: ArtifactClaim
  // Its chance on the board at that index with the artifact, or -1 on a board
  // whose map has no tile for each of its units.
  chanceOn: (board: number, artifact: number | null) => number
  // The best chance any artifact it can end up with gives it on any board
  // its pool serves.
  best: number
  // What measuring its fit on the board at that index needs, if not known yet.
  pending: (board: number) => SlFitRequest[]
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

// The search over each board's teams: those of a map in the file, or the rows
// of every map (null), as `reads` gives them per board.
function searcher(
  data: SlData,
  { model }: SlReader,
  picked: ReadonlyMap<number, SlPick>,
  counts: (artifact: number) => boolean,
  boards: readonly SlBoard[],
  fit: SlFit,
) {
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

  // A press's rounds reach the same sets again, and handing out a set's
  // artifacts tries every way to give out their own.
  const handOuts = new Map<string, readonly (number | null)[]>()
  const handOut = (teams: readonly Option[]): readonly (number | null)[] => {
    const key = teams.map((t) => `${t.source}:${t.team}`).join()
    let handed = handOuts.get(key)
    if (!handed) handOuts.set(key, (handed = handOutArtifacts(teams.map((t) => t.claim))))
    return handed
  }

  // Each board's teams the selection allows with the evidence asked, the best
  // first. Boards that take the same teams share one pool, which the search
  // relies on: the boards on one recorded map, and every board reading the
  // rows of every map, where a team's chance differs from map to map only by
  // its fit.
  const optionsFor = (proof: SlEvidence, reads: readonly (number | null)[]): Option[][] => {
    const pools = new Map<number | null, Option[]>()
    return reads.map((source) => {
      if (pools.has(source)) return pools.get(source)!
      const served = new Map(
        boards.filter((_, j) => reads[j] === source).map((b) => [b.layout.key, b] as const),
      )
      const list: readonly SlTeam[] = source === null ? data.everyMap : data.maps[source]!.teams
      const byFamily = new Map<number | null, number[]>()
      list.forEach((t, team) => {
        if (t.heroes.some(excluded)) return
        if (!byFamily.has(t.family)) byFamily.set(t.family, [])
        byFamily.get(t.family)!.push(team)
      })
      const found: Option[] = []
      for (const [family, teams] of byFamily) {
        if (family === null && !proof.oneOffs) continue
        if (
          !meets(
            teams.reduce((n, i) => n + list[i]!.games, 0),
            proof.groupGames,
          )
        )
          continue
        for (const team of teams) {
          const t = list[team]!
          if (t.decided < 1 || !(meets(t.players, proof.players) || meets(t.games, proof.games))) {
            continue
          }
          const shares = new Map<string, number | undefined>()
          for (const [layout, b] of served) {
            if (fit.stands(b, t.heroes)) shares.set(layout, fit.known(b, t.heroes))
          }
          if (!shares.size) continue
          const claim = claimOf(t)
          const points = gap(t.heroes)
          const cache = new Map<string, number>()
          const chanceAt = (share: number | undefined, artifact: number | null): number => {
            const key = `${share}|${artifact}`
            let chance = cache.get(key)
            if (chance === undefined) {
              const counted = artifact !== null && counts(artifact) ? artifact : null
              const side = { heroes: t.heroes, kind: family, artifact: counted }
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
              ...[...shares.values()].flatMap((share) => reachable.map((a) => chanceAt(share, a))),
            )
          const option: Option = {
            source,
            team,
            rank: t.rank,
            heroes: t.heroes,
            family,
            claim,
            chanceOn: (i, artifact) => {
              const layout = boards[i]!.layout.key
              return shares.has(layout) ? chanceAt(shares.get(layout), artifact) : -1
            },
            best: bestNow(),
            pending: (i) =>
              shares.get(boards[i]!.layout.key) === undefined
                ? [{ board: boards[i]!, heroes: t.heroes }]
                : [],
            refit: (i) => {
              const layout = boards[i]!.layout.key
              if (shares.get(layout) !== undefined) return false
              const share = fit.measure(boards[i]!, t.heroes)
              shares.set(layout, share)
              if (share === 1) return false
              option.best = bestNow()
              return true
            },
          }
          found.push(option)
        }
      }
      found.sort(byBest)
      pools.set(source, found)
      return found
    })
  }

  // A complete search, the board with the fewest teams first. The match
  // chance rises with each board's chance, so a branch is bounded by its
  // teams' best chances and, on each open board, the best chance of the first
  // team that still fits. A board's teams come best first, so once one falls
  // short, the rest of that board's teams do too. Boards sharing a pool take
  // its teams in pool order, so the same teams are never tried again in
  // another order, and an open board's first team comes after that of the
  // open board above it with the same pool; on such boards an artifact tie
  // goes to the better team.
  // Teams from the rows of every map then trade boards, keeping their
  // artifacts, where that raises the match chance.
  const bestSet = (pools: Option[][], unrecorded: readonly number[]): Found | null => {
    if (pools.some((pool) => !pool.length)) return null
    const trades = new Set(unrecorded.map((i) => boards[i]!.layout.key)).size > 1
    const reorders = trades ? permutations(unrecorded.length) : []
    const n = pools.length
    const order = pools.map((_, i) => i).sort((a, b) => pools[a]!.length - pools[b]!.length)
    const byDepth = order.map((i) => pools[i]!)
    let best: Found | null = null
    const chosen: Option[] = []
    // One spread over every pool's heroes passes tens of thousands of arguments
    // once five boards share the rows of every map, near Safari's limit for a call.
    const top = pools.reduce((m, pool) => pool.reduce((n, t) => Math.max(n, ...t.heroes), m), 0)
    // Each team's heroes as bits, `words` to a team, so a team fits beside the
    // chosen ones when none of its words meets `used`.
    const words = (top >> 5) + 1
    const used = new Int32Array(words)
    const bits = new Map<Option[], Int32Array>()
    for (const pool of pools) {
      if (bits.has(pool)) continue
      const row = new Int32Array(pool.length * words)
      pool.forEach((t, k) => {
        for (const h of t.heroes) row[k * words + (h >> 5)] |= 1 << (h & 31)
      })
      bits.set(pool, row)
    }
    const bitsByDepth = byDepth.map((pool) => bits.get(pool)!)
    const fits = (row: Int32Array, k: number): boolean => {
      for (let w = 0, at = k * words; w < words; w++, at++) if (row[at]! & used[w]!) return false
      return true
    }
    // first[d][j]: the first team of depth j's pool that fits beside the teams
    // chosen above depth d, and comes after those its pool gave them and, below
    // the top row (all zeros), after first[d] of the nearest depth above j with
    // the same pool, which takes an earlier team. Teams only join on the way
    // down, so it only moves forward.
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
      const handed = handOut(chosen)
      // Each traded team's chance on each board it can trade to.
      const across = unrecorded.map((i) =>
        unrecorded.map((j) => chosen[i]!.chanceOn(j, handed[i] ?? null)),
      )
      const alike = across.every((chances, a) => chances.every((c) => c === chances[a]))
      if (trades && !alike && best) {
        // No order beats every team on its best board, as a team keeps its
        // artifact when it trades.
        const ceiling = chosen.map((t, i) => {
          const a = unrecorded.indexOf(i)
          return a < 0 ? t.chanceOn(i, handed[i] ?? null) : Math.max(...across[a]!)
        })
        if (matchChance(ceiling) + ROUNDING < best.chance) return
      }
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
      const row = bitsByDepth[d]!
      const here = first[d]!
      const next = first[d + 1]!
      const after = twin[d]! < 0 ? 0 : taken[twin[d]!]! + 1
      for (let k = Math.max(here[d]!, after); k < pool.length; k++) {
        if (!fits(row, k)) continue
        const t = pool[k]!
        bound[d] = t.best
        if (best && boundFrom(d, here) <= best.chance) break
        for (let w = 0; w < words; w++) used[w] |= row[k * words + w]!
        let open = true
        for (let j = d + 1; j < n && open; j++) {
          const later = byDepth[j]!
          const above = twin[j]!
          let i = Math.max(here[j]!, above > d ? next[above]! + 1 : above === d ? k + 1 : 0)
          while (i < later.length && !fits(bitsByDepth[j]!, i)) i++
          next[j] = i
          open = i < later.length
        }
        if (open && (!best || boundFrom(d, next) > best.chance)) {
          taken[d] = k
          chosen[order[d]!] = t
          walk(d + 1)
        }
        for (let w = 0; w < words; w++) used[w] &= ~row[k * words + w]!
      }
    }
    walk(0)
    return best
  }

  const position = new Map(data.order.map((id, i) => [id, i]))
  const before = (a: number, b: number): boolean => position.get(a)! < position.get(b)!

  // The record under a board is its map's: a team drawn from the rows over
  // every map shows its group's there, or its own there outside every group.
  const recordOn = (
    source: number | null,
    t: Pick<SlTeam, 'heroes' | 'family'>,
  ): SlRecord | null => {
    if (source === null) return null
    const map = data.maps[source]!
    if (t.family !== null) return map.records[t.family]!
    const lineup = t.heroes.join()
    return map.teams.find((o) => o.heroes.join() === lineup)?.record ?? null
  }

  const answer = (set: Found): SlChoice => ({
    chance: set.chance,
    odds: [...oddsInto(set.chances, new Float64Array(boards.length + 1))],
    teams: set.teams.map((t, i) => {
      const artifact = set.artifacts[i] ?? null
      const counted = artifact !== null && counts(artifact) ? artifact : null
      const elsewhere = new Set(set.teams.filter((o) => o !== t).flatMap((o) => o.heroes))
      const swaps =
        t.family === null
          ? { core: [], flex: [], pairs: [] }
          : swapsOf(t.heroes, elsewhere, {
              family: data.families[t.family]!,
              chanceOf: (heroes) =>
                boardChance(model, { heroes, kind: t.family, artifact: null }, gap(heroes)),
              excluded,
              stands: (heroes) => fit.stands(boards[i]!, heroes),
              before,
              flex: data.flex,
            })
      const { source } = boards[i]!
      return {
        source: t.source,
        team: t.team,
        heroes: t.heroes,
        family: t.family,
        chance: set.chances[i]!,
        comp: recordOn(source, t),
        artifact,
        placement:
          t.source === null
            ? 0
            : (data.maps[t.source]!.teams[t.team]!.pick?.find(([a]) => a === counted)?.[1] ?? 0),
        ...swaps,
      }
    }),
  })

  // The best set with the strict rule, else the relaxed one, every chance
  // counting the fit of a team not yet measured at its most, so once a set's
  // teams are all measured, no other set can beat it. Placing a team is slow,
  // so only the teams a search picks are measured. Each round first yields
  // the fits it is about to measure.
  return {
    optionsFor,
    *choose(reads: readonly (number | null)[]): Steps {
      const unrecorded = reads.flatMap((read, i) => (read === null ? [i] : []))
      for (const proof of data.evidence) {
        const pools = optionsFor(proof, reads)
        let set = bestSet(pools, unrecorded)
        while (set) {
          const pending = set.teams.flatMap((t, i) => t.pending(i))
          if (pending.length) yield pending
          if (!set.teams.map((t, i) => t.refit(i)).some(Boolean)) break
          for (const pool of new Set(pools)) pool.sort(byBest)
          set = bestSet(pools, unrecorded)
        }
        if (set) return answer(set)
      }
      return null
    },
  }
}

type Steps = Generator<SlFitRequest[], SlChoice | null, void>

function* steps(
  data: SlData,
  reader: SlReader,
  picks: readonly SlPick[],
  counts: (artifact: number) => boolean,
  boards: readonly SlBoard[],
  fit: SlFit,
): Steps {
  const picked = new Map(picks.map((pick) => [pick.id, pick]))
  const search = searcher(data, reader, picked, counts, boards, fit)
  const own = boards.map((board) => board.source)
  const tried = new Set<string>()
  function* attempt(reads: (number | null)[]): Steps {
    const key = reads.join()
    if (tried.has(key)) return null
    tried.add(key)
    return yield* search.choose(reads)
  }
  const thin = (): (number | null)[] => {
    const pools = search.optionsFor(data.evidence.at(-1)!, own)
    return own.map((source, i) => (pools[i]!.length ? source : null))
  }
  return (yield* attempt(own)) ?? (yield* attempt(thin())) ?? (yield* attempt(own.map(() => null)))
}

/* The set for `picks`, or null when none can be made, on `boards` as slBoards
 * gives them. Each board first takes its own map's teams; where those make no
 * set, a board whose map's teams the selection leaves none of under the
 * relaxed rule takes the rows of every map, and then every board does.
 * `counts` says whether an artifact counts toward a chance: after a season
 * change the file's seasonal artifacts are out of the game, so the set still
 * hands them out and counts them as typical ones. `fit` keeps the fits it
 * measures for the next call. */
export function chooseSlSet(
  data: SlData,
  reader: SlReader,
  picks: readonly SlPick[],
  counts: (artifact: number) => boolean,
  boards: readonly SlBoard[],
  fit: SlFit = slFit(data),
): SlChoice | null {
  const run = steps(data, reader, picks, counts, boards, fit)
  let step = run.next()
  while (!step.done) step = run.next()
  return step.value
}

/* chooseSlSet for a caller that works each round's fits out before the round
 * measures them, such as in helpers side by side: `prepare` gets the round's
 * teams not measured yet, and stores their fits where `fit` reads them. */
export async function chooseSlSetAsync(
  data: SlData,
  reader: SlReader,
  picks: readonly SlPick[],
  counts: (artifact: number) => boolean,
  boards: readonly SlBoard[],
  fit: SlFit,
  prepare: (requests: SlFitRequest[]) => Promise<void>,
): Promise<SlChoice | null> {
  const run = steps(data, reader, picks, counts, boards, fit)
  let step = run.next()
  while (!step.done) {
    await prepare(step.value)
    step = run.next()
  }
  return step.value
}
