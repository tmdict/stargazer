import { MAX_RECOMMENDATIONS } from './constants'
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

const WEIGHT_WIN_RATE = 0.6
const WEIGHT_PICK_RATE = 0.4

const CONTEXT_MIN_MATCHES = 3
const BAYESIAN_PRIOR = 1.0

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

export const metaPickModel: RecommendationModel = {
  id: 'meta-pick',
  name: 'Meta Pick',

  recommend(
    teammates: string[],
    opponents: string[],
    available: string[],
    analysisData: AnalysisData,
    matches: MatchResult[],
  ): Recommendation[] {
    const maxMatches = Math.max(...available.map((h) => analysisData.heroStats[h]?.matches || 0), 1)

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

      const score = WEIGHT_WIN_RATE * winRate + WEIGHT_PICK_RATE * normalizedPickRate

      return {
        hero,
        score,
        confidence: getHeroWilsonConfidence(stats),
        breakdown: { winRate, overallWinRate, pickRate, contextMatches },
        relevantNotes: getRelevantNotes(hero, matches),
      }
    })

    return recommendations.sort((a, b) => b.score - a.score).slice(0, MAX_RECOMMENDATIONS)
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
        total += winRate
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
