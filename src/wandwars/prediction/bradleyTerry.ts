import { BT_CONVERGENCE_TOLERANCE, BT_MAX_ITERATIONS } from '../constants'
import type {
  AnalysisData,
  MatchResult,
  MatchupPrediction,
  Recommendation,
  RecommendationModel,
} from '../types'
import {
  getHeroWilsonConfidence,
  getMatchupNotes,
  getRelevantNotes,
  getWorstConfidence,
} from './modelUtils'

interface BTMatch {
  leftHeroes: string[]
  rightHeroes: string[]
  leftWeight: number
  rightWeight: number
}

function prepareMatches(matches: MatchResult[]): BTMatch[] {
  return matches.map((m) => {
    if (m.result === 'draw') {
      const halfWeight = m.weight * 0.5
      return {
        leftHeroes: [...m.left],
        rightHeroes: [...m.right],
        leftWeight: halfWeight,
        rightWeight: halfWeight,
      }
    }
    return {
      leftHeroes: [...m.left],
      rightHeroes: [...m.right],
      leftWeight: m.result === 'left' ? m.weight : 0,
      rightWeight: m.result === 'right' ? m.weight : 0,
    }
  })
}

// Regularization strength: acts as "virtual matches" pulling λ toward 1.0
// Higher = stronger pull toward average. Scales inversely with hero match count.
const REGULARIZATION_STRENGTH = 3.0

/**
 * Fit Bradley-Terry parameters with L2 regularization.
 *
 * Standard MM update: λ_new = totalWins / denomSum
 *
 * Regularized: adds virtual observations pulling λ toward 1.0.
 * The regularization weight is inversely proportional to the hero's match count,
 * so well-tested heroes are barely affected while rarely-seen heroes are pulled
 * strongly toward average (λ = 1.0).
 *
 * This is the proper Bayesian approach: equivalent to a Gamma prior on λ
 * centered at 1.0, with strength proportional to REGULARIZATION_STRENGTH.
 */
function fitParameters(
  btMatches: BTMatch[],
  allHeroes: string[],
  heroMatchCounts: Map<string, number>,
): Map<string, number> {
  const strengths = new Map<string, number>()
  for (const hero of allHeroes) {
    strengths.set(hero, 1.0)
  }

  for (let iter = 0; iter < BT_MAX_ITERATIONS; iter++) {
    const newStrengths = new Map<string, number>()
    let maxDelta = 0

    for (const hero of allHeroes) {
      let totalWins = 0
      let denomSum = 0

      for (const match of btMatches) {
        const isLeft = match.leftHeroes.includes(hero)
        const isRight = match.rightHeroes.includes(hero)
        if (!isLeft && !isRight) continue

        const leftStrength = match.leftHeroes.reduce((sum, h) => sum + (strengths.get(h) || 1), 0)
        const rightStrength = match.rightHeroes.reduce((sum, h) => sum + (strengths.get(h) || 1), 0)
        const totalStrength = leftStrength + rightStrength
        const matchWeight = match.leftWeight + match.rightWeight

        if (isLeft) {
          totalWins += match.leftWeight
          denomSum += matchWeight / totalStrength
        }
        if (isRight) {
          totalWins += match.rightWeight
          denomSum += matchWeight / totalStrength
        }
      }

      // Regularization: add virtual observations pulling toward λ = 1.0
      // Strength of pull is inversely proportional to match count
      const matchCount = heroMatchCounts.get(hero) || 0
      const regWeight = REGULARIZATION_STRENGTH / (1 + matchCount)
      // Virtual wins at λ = 1.0: adds regWeight to numerator
      totalWins += regWeight
      // Virtual denominator contribution: regWeight / (λ_current + 1.0) ≈ regWeight / 2
      // Using current strength for more accurate regularization
      const currentStrength = strengths.get(hero) || 1.0
      denomSum += regWeight / ((currentStrength + 1.0) / 2)

      const newVal = denomSum > 0 ? totalWins / denomSum : 1.0
      newStrengths.set(hero, newVal)
      maxDelta = Math.max(maxDelta, Math.abs(newVal - currentStrength))
    }

    // Normalize so parameters average to 1.0
    const avg = [...newStrengths.values()].reduce((s, v) => s + v, 0) / newStrengths.size
    for (const [hero, val] of newStrengths) {
      strengths.set(hero, val / avg)
    }

    if (maxDelta < BT_CONVERGENCE_TOLERANCE) break
  }

  return strengths
}

function predictWinProbability(
  leftTeam: string[],
  rightTeam: string[],
  strengths: Map<string, number>,
): number {
  const leftStrength = leftTeam.reduce((sum, h) => sum + (strengths.get(h) || 1), 0)
  const rightStrength = rightTeam.reduce((sum, h) => sum + (strengths.get(h) || 1), 0)
  const total = leftStrength + rightStrength
  return total > 0 ? leftStrength / total : 0.5
}

function computeAverageTeamStrength(strengths: Map<string, number>): number {
  const values = [...strengths.values()]
  if (values.length === 0) return 3.0
  const avg = values.reduce((s, v) => s + v, 0) / values.length
  return avg * 3
}

function buildMatchCountMap(analysisData: AnalysisData): Map<string, number> {
  const counts = new Map<string, number>()
  for (const hero of analysisData.allHeroes) {
    counts.set(hero, analysisData.heroStats[hero]?.matches || 0)
  }
  return counts
}

export const bradleyTerryModel: RecommendationModel = {
  id: 'bradley-terry',
  name: 'Team Power',

  recommend(
    teammates: string[],
    opponents: string[],
    available: string[],
    analysisData: AnalysisData,
    matches: MatchResult[],
  ): Recommendation[] {
    const btMatches = prepareMatches(matches)
    const matchCounts = buildMatchCountMap(analysisData)
    const strengths = fitParameters(btMatches, analysisData.allHeroes, matchCounts)
    const avgOpponentStrength = computeAverageTeamStrength(strengths)

    const recommendations: Recommendation[] = available.map((hero) => {
      const candidateTeam = [...teammates, hero]
      let winProb: number
      if (opponents.length > 0) {
        winProb = predictWinProbability(candidateTeam, opponents, strengths)
      } else {
        const teamStrength = candidateTeam.reduce((sum, h) => sum + (strengths.get(h) || 1), 0)
        winProb = teamStrength / (teamStrength + avgOpponentStrength)
      }

      return {
        hero,
        score: winProb,
        confidence: getHeroWilsonConfidence(analysisData.heroStats[hero]),
        breakdown: {
          strength: strengths.get(hero) || 1.0,
          winProbability: winProb,
          pickRate:
            analysisData.totalMatches > 0
              ? (analysisData.heroStats[hero]?.matches || 0) / analysisData.totalMatches
              : 0,
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
    const btMatches = prepareMatches(matches)
    const matchCounts = buildMatchCountMap(analysisData)
    const strengths = fitParameters(btMatches, analysisData.allHeroes, matchCounts)
    const leftProb = predictWinProbability(leftTeam, rightTeam, strengths)
    const leftStrength = leftTeam.reduce((s, h) => s + (strengths.get(h) || 1), 0)
    const rightStrength = rightTeam.reduce((s, h) => s + (strengths.get(h) || 1), 0)

    return {
      leftWinProbability: leftProb,
      rightWinProbability: 1 - leftProb,
      confidence: getWorstConfidence([...leftTeam, ...rightTeam], analysisData),
      breakdown: { leftStrength, rightStrength },
      relevantNotes: getMatchupNotes(leftTeam, rightTeam, matches),
    }
  },
}
