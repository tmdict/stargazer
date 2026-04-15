import {
  getHeroWilsonConfidence,
  getMatchupNotes,
  getRelevantNotes,
  getWorstConfidence,
} from './modelUtils'
import type {
  AnalysisData,
  MatchResult,
  MatchupPrediction,
  Recommendation,
  RecommendationModel,
} from './types'

// Weights shift as teammates are picked
// 0 teammates: 60% win rate, 40% pick rate, 0% pair
// 1 teammate:  35% win rate, 20% pick rate, 45% pair
// 2 teammates: 25% win rate, 15% pick rate, 60% pair (pairs + trio)
const WEIGHTS = {
  0: { winRate: 0.6, pickRate: 0.4, pair: 0 },
  1: { winRate: 0.35, pickRate: 0.2, pair: 0.45 },
  2: { winRate: 0.25, pickRate: 0.15, pair: 0.6 },
} as Record<number, { winRate: number; pickRate: number; pair: number }>

const CONTEXT_MIN_MATCHES = 3
const BAYESIAN_PRIOR = 1.0

/**
 * Compute pair win record: wins and total matches where candidate
 * and a specific teammate appeared on the same team.
 */
function pairRecord(
  candidate: string,
  teammate: string,
  matches: MatchResult[],
): { wins: number; total: number; winRate: number } {
  let wins = 0
  let total = 0

  for (const match of matches) {
    const onLeft = match.left.includes(candidate) && match.left.includes(teammate)
    const onRight = match.right.includes(candidate) && match.right.includes(teammate)
    if (!onLeft && !onRight) continue

    total++
    const won = (onLeft && match.result === 'left') || (onRight && match.result === 'right')
    if (won) wins += match.weight
    else if (match.result !== 'draw') total += match.weight - 1
  }

  const winRate = total > 0 ? (wins + BAYESIAN_PRIOR) / (total + 2 * BAYESIAN_PRIOR) : 0.5

  return { wins: Math.round(wins), total, winRate }
}

/**
 * Compute trio win record: wins and total matches where all three
 * heroes appeared on the same team.
 */
function trioRecord(
  candidate: string,
  teammate1: string,
  teammate2: string,
  matches: MatchResult[],
): { wins: number; total: number; winRate: number } {
  let wins = 0
  let total = 0

  for (const match of matches) {
    const onLeft =
      match.left.includes(candidate) &&
      match.left.includes(teammate1) &&
      match.left.includes(teammate2)
    const onRight =
      match.right.includes(candidate) &&
      match.right.includes(teammate1) &&
      match.right.includes(teammate2)
    if (!onLeft && !onRight) continue

    total++
    const won = (onLeft && match.result === 'left') || (onRight && match.result === 'right')
    if (won) wins += match.weight
    else if (match.result !== 'draw') total += match.weight - 1
  }

  const winRate = total > 0 ? (wins + BAYESIAN_PRIOR) / (total + 2 * BAYESIAN_PRIOR) : 0.5

  return { wins: Math.round(wins), total, winRate }
}

/**
 * Compute contextual win rate filtering by teammates and opponents.
 * Falls back to overall win rate when insufficient data, blending proportionally.
 */
function contextualWinRate(
  candidate: string,
  teammates: string[],
  opponents: string[],
  matches: MatchResult[],
  overallWinRate: number,
): { winRate: number; contextMatches: number } {
  if (teammates.length === 0 && opponents.length === 0) {
    return { winRate: overallWinRate, contextMatches: 0 }
  }

  let contextWins = 0
  let contextTotal = 0

  for (const match of matches) {
    const onLeft = match.left.includes(candidate)
    const onRight = match.right.includes(candidate)
    if (!onLeft && !onRight) continue

    const candidateTeam = onLeft ? match.left : match.right
    const opposingTeam = onLeft ? match.right : match.left
    const candidateWon =
      (onLeft && match.result === 'left') || (onRight && match.result === 'right')

    if (teammates.length > 0 && !teammates.every((t) => candidateTeam.includes(t))) continue
    if (opponents.length > 0 && !opponents.every((o) => opposingTeam.includes(o))) continue

    contextTotal++
    if (candidateWon) contextWins += match.weight
    else if (match.result !== 'draw') contextTotal += match.weight - 1
  }

  if (contextTotal < CONTEXT_MIN_MATCHES) {
    const blend = contextTotal / CONTEXT_MIN_MATCHES
    return {
      winRate:
        blend * ((contextWins + BAYESIAN_PRIOR) / (contextTotal + 2 * BAYESIAN_PRIOR)) +
        (1 - blend) * overallWinRate,
      contextMatches: contextTotal,
    }
  }

  return {
    winRate: (contextWins + BAYESIAN_PRIOR) / (contextTotal + 2 * BAYESIAN_PRIOR),
    contextMatches: contextTotal,
  }
}

/**
 * Compute the combined pair score for a candidate given current teammates.
 * - 1 teammate: pair win rate with that teammate
 * - 2 teammates: average of pair win rates with each + trio bonus
 */
function computePairScore(
  candidate: string,
  teammates: string[],
  matches: MatchResult[],
): { score: number; pairDetails: { teammate: string; wins: number; total: number }[] } {
  if (teammates.length === 0) {
    return { score: 0.5, pairDetails: [] }
  }

  const pairDetails: { teammate: string; wins: number; total: number }[] = []
  let totalPairWinRate = 0

  for (const mate of teammates) {
    const record = pairRecord(candidate, mate, matches)
    pairDetails.push({ teammate: mate, wins: record.wins, total: record.total })
    totalPairWinRate += record.winRate
  }

  let score = totalPairWinRate / teammates.length

  // If 2 teammates, blend in trio record
  if (teammates.length === 2) {
    const trio = trioRecord(candidate, teammates[0]!, teammates[1]!, matches)
    if (trio.total > 0) {
      // Weight trio at 40% of the pair component, individual pairs at 60%
      score = 0.6 * score + 0.4 * trio.winRate
    }
  }

  return { score, pairDetails }
}

export const popularPickModel: RecommendationModel = {
  id: 'popular-pick',
  name: 'Popular Pick',

  recommend(
    teammates: string[],
    opponents: string[],
    available: string[],
    analysisData: AnalysisData,
    matches: MatchResult[],
  ): Recommendation[] {
    const maxMatches = Math.max(...available.map((h) => analysisData.heroStats[h]?.matches || 0), 1)

    const teamCount = Math.min(teammates.length, 2) as 0 | 1 | 2
    const w = WEIGHTS[teamCount]!

    const recommendations: Recommendation[] = available.map((hero) => {
      const stats = analysisData.heroStats[hero]
      const overallWinRate = stats?.winRate || 0.5
      const heroMatches = stats?.matches || 0
      const pickRate = heroMatches / analysisData.totalMatches
      const normalizedPickRate = heroMatches / maxMatches

      const { winRate, contextMatches } = contextualWinRate(
        hero,
        teammates,
        opponents,
        matches,
        overallWinRate,
      )

      const { score: pairScore, pairDetails } = computePairScore(hero, teammates, matches)

      const score = w.winRate * winRate + w.pickRate * normalizedPickRate + w.pair * pairScore

      return {
        hero,
        score,
        confidence: getHeroWilsonConfidence(stats),
        breakdown: {
          winRate,
          overallWinRate,
          pickRate,
          contextMatches,
          pairDetails,
        },
        relevantNotes: getRelevantNotes(hero, matches),
      }
    })

    return recommendations.sort((a, b) => b.score - a.score)
  },

  predictMatchup(
    leftTeam: string[],
    rightTeam: string[],
    analysisData: AnalysisData,
    matches: MatchResult[],
  ): MatchupPrediction {
    function teamMetaScore(team: string[], opponents: string[]): number {
      let total = 0
      for (const hero of team) {
        const overallWinRate = analysisData.heroStats[hero]?.winRate || 0.5
        const teammates = team.filter((h) => h !== hero)
        const { winRate } = contextualWinRate(hero, teammates, opponents, matches, overallWinRate)
        const { score: pairScore } = computePairScore(hero, teammates, matches)
        // Full team: pair data is most reliable
        total += 0.4 * winRate + 0.6 * pairScore
      }
      return total
    }

    const leftScore = teamMetaScore(leftTeam, rightTeam)
    const rightScore = teamMetaScore(rightTeam, leftTeam)
    const total = leftScore + rightScore
    const leftProb = total > 0 ? leftScore / total : 0.5

    return {
      leftWinProbability: leftProb,
      rightWinProbability: 1 - leftProb,
      confidence: getWorstConfidence([...leftTeam, ...rightTeam], analysisData),
      breakdown: { leftScore, rightScore },
      relevantNotes: getMatchupNotes(leftTeam, rightTeam, matches),
    }
  },
}
