import { BT_CONVERGENCE_TOLERANCE, BT_MAX_ITERATIONS, MAX_RECOMMENDATIONS } from './constants'
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

function fitParameters(btMatches: BTMatch[], allHeroes: string[]): Map<string, number> {
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

      const newVal = denomSum > 0 ? totalWins / denomSum : 1.0
      newStrengths.set(hero, newVal)
      maxDelta = Math.max(maxDelta, Math.abs(newVal - (strengths.get(hero) || 1)))
    }

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

export const bradleyTerryModel: RecommendationModel = {
  id: 'bradley-terry',
  name: 'Bradley-Terry',

  recommend(
    teammates: string[],
    opponents: string[],
    available: string[],
    analysisData: AnalysisData,
    matches: MatchResult[],
  ): Recommendation[] {
    const btMatches = prepareMatches(matches)
    const strengths = fitParameters(btMatches, analysisData.allHeroes)
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
        breakdown: { strength: strengths.get(hero) || 1.0, winProbability: winProb },
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
    const btMatches = prepareMatches(matches)
    const strengths = fitParameters(btMatches, analysisData.allHeroes)
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
