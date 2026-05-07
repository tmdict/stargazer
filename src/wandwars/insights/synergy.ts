import {
  INSIGHT_NOTABLE_WINRATE,
  INSIGHT_SYNERGY_CLASH,
  INSIGHT_SYNERGY_NOTABLE,
  metaMinPairMatches,
} from '@/wandwars/constants'
import { formatPercent } from '@/wandwars/formatting'
import { nnForward } from '@/wandwars/prediction/nn'
import { NN_WEIGHTS } from '@/wandwars/prediction/nnWeights'
import type { MatchResult, SynergyMatrix } from '@/wandwars/types'
import type { Insight, InsightDeps } from './types'

interface PairRecord {
  heroA: string
  heroB: string
  wins: number
  losses: number
  total: number
  synergy: number
}

interface AllSynergyPair {
  a: string
  b: string
  score: number
  wins: number
  losses: number
  matches: number
}

// Pairs sorted by synergy score, capped at 8 entries — used for "strongest synergy"
// and the team-player aggregations below.
function computeStrongestPairs(matrix: SynergyMatrix, pairThreshold: number): PairRecord[] {
  const pairs: PairRecord[] = []
  const seen = new Set<string>()
  for (const [heroA, partners] of Object.entries(matrix)) {
    for (const [heroB, entry] of Object.entries(partners)) {
      const key = [heroA, heroB].sort().join(':')
      if (seen.has(key)) continue
      seen.add(key)
      if (entry.matches < pairThreshold) continue
      pairs.push({
        heroA: heroA < heroB ? heroA : heroB,
        heroB: heroA < heroB ? heroB : heroA,
        wins: entry.wins,
        losses: entry.losses,
        total: entry.matches,
        synergy: entry.score,
      })
    }
  }
  return pairs
    .filter((p) => p.wins > p.losses)
    .sort((a, b) => b.synergy - a.synergy || b.total - a.total)
    .slice(0, 8)
}

// All pairs above the matches threshold (for weakest-synergy / most-played / etc.).
function computeAllSynergyPairs(matrix: SynergyMatrix, pairThreshold: number): AllSynergyPair[] {
  const pairs: AllSynergyPair[] = []
  const seen = new Set<string>()
  for (const [heroA, partners] of Object.entries(matrix)) {
    for (const [heroB, entry] of Object.entries(partners)) {
      const key = [heroA, heroB].sort().join(':')
      if (seen.has(key)) continue
      seen.add(key)
      if (entry.matches < pairThreshold) continue
      pairs.push({
        a: heroA < heroB ? heroA : heroB,
        b: heroA < heroB ? heroB : heroA,
        score: entry.score,
        wins: entry.wins,
        losses: entry.losses,
        matches: entry.matches,
      })
    }
  }
  return pairs
}

// For a given hero pair, count how many *distinct full opponent teams* they beat.
// Used to distinguish a versatile pair from one that just farmed the same matchup.
function pairOpponentDiversity(
  matchData: MatchResult[],
  heroA: string,
  heroB: string,
): { opponents: number; wins: number } {
  const oppTeams = new Set<string>()
  let wins = 0
  for (const match of matchData) {
    for (const [team, oppTeam, isWin] of [
      [match.left, match.right, match.result === 'left'],
      [match.right, match.left, match.result === 'right'],
    ] as const) {
      if (!isWin) continue
      const s = new Set(team)
      if (s.has(heroA) && s.has(heroB)) {
        oppTeams.add([...oppTeam].sort().join(','))
        wins++
      }
    }
  }
  return { opponents: oppTeams.size, wins }
}

export function buildSynergy(deps: InsightDeps): Insight[] {
  const result: Insight[] = []
  const { t, matchData, analysisData, topSweepPair } = deps
  const totalMatches = matchData.length
  const matrix = analysisData.synergyMatrix
  const pairMin = metaMinPairMatches(totalMatches)

  const ti = (key: string, vars?: Record<string, string | number>) =>
    t(`wandwars.insights/${key}`, vars)
  const add = (text: string) => result.push({ text, category: 'synergy' })

  const strongestPairs = computeStrongestPairs(matrix, pairMin)
  const allSynergyPairs = computeAllSynergyPairs(matrix, pairMin)

  // 1. Strongest synergy pair — but warn if it's just farming one matchup.
  const topPair = strongestPairs[0]
  if (topPair && topPair.synergy > INSIGHT_SYNERGY_NOTABLE) {
    const diversity = pairOpponentDiversity(matchData, topPair.heroA, topPair.heroB)
    if (diversity.wins >= 3 && diversity.opponents <= 1) {
      add(
        ti('synergy-counter-warning', {
          heroA: `{${topPair.heroA}}`,
          heroB: `{${topPair.heroB}}`,
          wins: topPair.wins,
          losses: topPair.losses,
        }),
      )
    } else {
      add(
        ti('strongest-synergy', {
          heroA: `{${topPair.heroA}}`,
          heroB: `{${topPair.heroB}}`,
          score: (topPair.synergy * 100).toFixed(1),
          wins: topPair.wins,
          losses: topPair.losses,
        }),
      )
    }
  }

  // 2. Weakest synergy pair
  const worstPair = [...allSynergyPairs].sort((a, b) => a.score - b.score)[0]
  if (worstPair && worstPair.score < -INSIGHT_SYNERGY_NOTABLE) {
    add(
      ti('weakest-synergy', {
        heroA: `{${worstPair.a}}`,
        heroB: `{${worstPair.b}}`,
        score: (worstPair.score * 100).toFixed(1),
        wins: worstPair.wins,
        losses: worstPair.losses,
      }),
    )
  }

  // 3. Most played pair — already filtered by pairMin upstream.
  const mostPlayedPair = [...allSynergyPairs].sort((a, b) => b.matches - a.matches)[0]
  if (mostPlayedPair) {
    add(
      ti('most-played-pair', {
        heroA: `{${mostPlayedPair.a}}`,
        heroB: `{${mostPlayedPair.b}}`,
        matches: mostPlayedPair.matches,
        wins: mostPlayedPair.wins,
        losses: mostPlayedPair.losses,
      }),
    )
  }

  // 4. Best team player — hero appearing in the most strong pairs.
  const heroPairCounts: Record<string, number> = {}
  for (const pair of strongestPairs) {
    heroPairCounts[pair.heroA] = (heroPairCounts[pair.heroA] || 0) + 1
    heroPairCounts[pair.heroB] = (heroPairCounts[pair.heroB] || 0) + 1
  }
  const bestPairHero = Object.entries(heroPairCounts).sort(([, a], [, b]) => b - a)[0]
  if (bestPairHero && bestPairHero[1] >= 2) {
    add(ti('best-team-player', { hero: `{${bestPairHero[0]}}`, count: bestPairHero[1] }))
  }

  // 5. Worst team player — hero appearing in the most weak pairs.
  const heroWeakPairCounts: Record<string, number> = {}
  for (const pair of allSynergyPairs) {
    if (pair.score < -INSIGHT_SYNERGY_CLASH) {
      heroWeakPairCounts[pair.a] = (heroWeakPairCounts[pair.a] || 0) + 1
      heroWeakPairCounts[pair.b] = (heroWeakPairCounts[pair.b] || 0) + 1
    }
  }
  const worstPairHero = Object.entries(heroWeakPairCounts).sort(([, a], [, b]) => b - a)[0]
  if (worstPairHero && worstPairHero[1] >= 2) {
    add(ti('worst-team-player', { hero: `{${worstPairHero[0]}}`, count: worstPairHero[1] }))
  }

  // 6. Pair with broad opponent coverage (cap at 1).
  for (const pair of strongestPairs.slice(0, 5)) {
    const diversity = pairOpponentDiversity(matchData, pair.heroA, pair.heroB)
    if (diversity.opponents >= 3) {
      add(
        ti('reliable-combo', {
          heroA: `{${pair.heroA}}`,
          heroB: `{${pair.heroB}}`,
          count: diversity.opponents,
        }),
      )
      break
    }
  }

  // 7. Concentrated synergy warning (cap at 1).
  for (const pair of strongestPairs.slice(1, 6)) {
    if (pair.synergy <= INSIGHT_SYNERGY_CLASH) continue
    const diversity = pairOpponentDiversity(matchData, pair.heroA, pair.heroB)
    if (diversity.wins >= 3 && diversity.opponents <= 1) {
      add(ti('synergy-overstated', { heroA: `{${pair.heroA}}`, heroB: `{${pair.heroB}}` }))
      break
    }
  }

  // 8-9. Undefeated pairs (cap at 2).
  const undefeatedPairs = allSynergyPairs
    .filter((p) => p.losses === 0)
    .sort((a, b) => b.matches - a.matches)
    .slice(0, 2)
  for (const pair of undefeatedPairs) {
    add(
      ti('pair-undefeated', {
        heroA: `{${pair.a}}`,
        heroB: `{${pair.b}}`,
        wins: pair.wins,
        matches: pair.matches,
      }),
    )
  }

  // 10. Winless pair (cap at 1).
  const winlessPair = allSynergyPairs
    .filter((p) => p.wins === 0)
    .sort((a, b) => b.matches - a.matches)[0]
  if (winlessPair) {
    add(
      ti('pair-winless', {
        heroA: `{${winlessPair.a}}`,
        heroB: `{${winlessPair.b}}`,
        losses: winlessPair.losses,
        matches: winlessPair.matches,
      }),
    )
  }

  // 11. Most dominant pair (most sweeps).
  if (topSweepPair && topSweepPair.sweeps >= 2) {
    const p = topSweepPair.team
    add(
      ti('pair-most-dominant', {
        p0: `{${p[0]}}`,
        p1: `{${p[1]}}`,
        sweeps: topSweepPair.sweeps,
        total: topSweepPair.total,
      }),
    )
  }

  // --- ML: NN-predicted unexplored synergies ---

  const nnHeroes = Object.keys(NN_WEIGHTS.heroIndex)
  const unexplored: { a: string; b: string; score: number }[] = []
  const sampleStep = Math.max(1, Math.floor(nnHeroes.length / 5))
  for (let i = 0; i < nnHeroes.length; i++) {
    for (let j = i + 1; j < nnHeroes.length; j++) {
      const a = nnHeroes[i]!
      const b = nnHeroes[j]!
      const pairData = matrix[a]?.[b]?.matches || 0
      if (pairData >= 5) continue // already well-tested
      let total = 0
      let count = 0
      for (let k = 0; k < nnHeroes.length && count < 5; k += sampleStep) {
        if (k === i || k === j) continue
        const teamIdx = [NN_WEIGHTS.heroIndex[a]!, NN_WEIGHTS.heroIndex[b]!, k]
        for (let oa = 0; oa < nnHeroes.length && count < 5; oa += sampleStep * 2) {
          for (let ob = oa + 1; ob < nnHeroes.length && count < 5; ob += sampleStep * 2) {
            for (let oc = ob + 1; oc < nnHeroes.length && count < 5; oc += sampleStep * 2) {
              if ([oa, ob, oc].some((x) => teamIdx.includes(x))) continue
              total += nnForward(NN_WEIGHTS, teamIdx, [oa, ob, oc])
              count++
            }
          }
        }
      }
      if (count > 0) unexplored.push({ a, b, score: total / count })
    }
  }
  unexplored.sort((a, b) => b.score - a.score)
  for (const pair of unexplored.slice(0, 2)) {
    if (pair.score > INSIGHT_NOTABLE_WINRATE) {
      const pairMatches = matrix[pair.a]?.[pair.b]?.matches || 0
      const dataNote =
        pairMatches === 0 ? ti('never-played') : ti('few-matches', { matches: pairMatches })
      add(
        ti('unexplored-synergy', {
          heroA: `{${pair.a}}`,
          heroB: `{${pair.b}}`,
          winRate: formatPercent(pair.score),
          dataNote,
        }),
      )
    }
  }

  return result
}
