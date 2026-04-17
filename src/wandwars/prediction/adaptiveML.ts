/**
 * Adaptive ML model — learned hero embeddings with a small neural network.
 * Weights are pre-trained offline and loaded at runtime.
 */

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
import { heroNamesToIndices, nnForward } from './nn'
import { NN_WEIGHTS } from './nnWeights'

function predictWinProb(leftHeroes: string[], rightHeroes: string[]): number {
  const leftIdx = heroNamesToIndices(leftHeroes, NN_WEIGHTS.heroIndex)
  const rightIdx = heroNamesToIndices(rightHeroes, NN_WEIGHTS.heroIndex)

  // Need at least 1 hero per side for a meaningful prediction
  if (leftIdx.length === 0 || rightIdx.length === 0) return 0.5

  return nnForward(NN_WEIGHTS, leftIdx, rightIdx)
}

/** Average team embedding used as baseline when opponents are unknown */
function predictVsAverage(teamHeroes: string[]): number {
  const teamIdx = heroNamesToIndices(teamHeroes, NN_WEIGHTS.heroIndex)
  if (teamIdx.length === 0) return 0.5

  // Use all heroes as a "generic" opponent pool — average over multiple random trios
  // Simplified: predict vs the zero-difference baseline (team vs itself ≈ 0.5),
  // then shift by how much the team embedding deviates from average
  const numHeroes = Object.keys(NN_WEIGHTS.heroIndex).length
  const allIdx = Array.from({ length: numHeroes }, (_, i) => i)

  // Sample a few "average" opponent teams
  let totalProb = 0
  let count = 0
  const step = Math.max(1, Math.floor(numHeroes / 10))
  for (let a = 0; a < numHeroes; a += step) {
    for (let b = a + 1; b < numHeroes; b += step) {
      for (let c = b + 1; c < numHeroes; c += step) {
        if (teamIdx.includes(a) || teamIdx.includes(b) || teamIdx.includes(c)) continue
        totalProb += nnForward(NN_WEIGHTS, teamIdx, [allIdx[a]!, allIdx[b]!, allIdx[c]!])
        count++
        if (count >= 50) break
      }
      if (count >= 50) break
    }
    if (count >= 50) break
  }

  return count > 0 ? totalProb / count : 0.5
}

export const adaptiveMLModel: RecommendationModel = {
  id: 'adaptive-ml',
  name: 'Adaptive ML',

  recommend(
    teammates: string[],
    opponents: string[],
    available: string[],
    analysisData: AnalysisData,
    matches: MatchResult[],
  ): Recommendation[] {
    const recommendations: Recommendation[] = available.map((hero) => {
      const candidateTeam = [...teammates, hero]
      let winProb: number

      if (opponents.length > 0) {
        winProb = predictWinProb(candidateTeam, opponents)
      } else {
        winProb = predictVsAverage(candidateTeam)
      }

      const heroMatches = analysisData.heroStats[hero]?.matches || 0
      const knownHero = hero in NN_WEIGHTS.heroIndex

      return {
        hero,
        score: winProb,
        confidence:
          knownHero && heroMatches >= 5
            ? getHeroWilsonConfidence(analysisData.heroStats[hero])
            : 'low',
        breakdown: {
          winProbability: winProb,
          pickRate: analysisData.totalMatches > 0 ? heroMatches / analysisData.totalMatches : 0,
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
    const leftProb = predictWinProb(leftTeam, rightTeam)

    return {
      leftWinProbability: leftProb,
      rightWinProbability: 1 - leftProb,
      confidence: getWorstConfidence([...leftTeam, ...rightTeam], analysisData),
      breakdown: {},
      relevantNotes: getMatchupNotes(leftTeam, rightTeam, matches),
    }
  },
}
