import {
  BT_CONVERGENCE_TOLERANCE,
  BT_MAX_ITERATIONS,
  MAX_RECOMMENDATIONS,
} from './constants'
import { wilsonConfidence } from './confidence'
import type { AnalysisData, MatchNote, MatchResult, MatchupPrediction, Recommendation, RecommendationModel } from './types'

interface BTMatch {
  leftHeroes: string[]
  rightHeroes: string[]
  leftWeight: number
  rightWeight: number
}

function prepareMatches(matches: MatchResult[]): BTMatch[] {
  return matches.map((m) => {
    if (m.result === 'draw') {
      // Treat draws as 0.5 wins for each side
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

function fitParameters(
  btMatches: BTMatch[],
  allHeroes: string[],
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

        const leftStrength = match.leftHeroes.reduce(
          (sum, h) => sum + (strengths.get(h) || 1),
          0,
        )
        const rightStrength = match.rightHeroes.reduce(
          (sum, h) => sum + (strengths.get(h) || 1),
          0,
        )
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

      const delta = Math.abs(newVal - (strengths.get(hero) || 1))
      maxDelta = Math.max(maxDelta, delta)
    }

    // Normalize so parameters average to 1.0
    const avg =
      [...newStrengths.values()].reduce((s, v) => s + v, 0) / newStrengths.size
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

function getRelevantNotes(
  candidate: string,
  matches: MatchResult[],
): MatchNote[] {
  const notes: MatchNote[] = []
  for (const match of matches) {
    for (const note of match.notes) {
      if (note.heroes.includes(candidate)) {
        notes.push(note)
      }
    }
  }
  return notes
}

function computeAverageTeamStrength(strengths: Map<string, number>): number {
  const values = [...strengths.values()]
  if (values.length === 0) return 3.0
  const avg = values.reduce((s, v) => s + v, 0) / values.length
  return avg * 3 // 3 heroes per team
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
        // No opponents known: compare against average team strength
        const teamStrength = candidateTeam.reduce(
          (sum, h) => sum + (strengths.get(h) || 1),
          0,
        )
        winProb = teamStrength / (teamStrength + avgOpponentStrength)
      }

      const heroStrength = strengths.get(hero) || 1.0
      const heroStats = analysisData.heroStats[hero]
      const confidence = heroStats
        ? wilsonConfidence(heroStats.wins + heroStats.draws * 0.5, heroStats.matches)
        : 'low' as const

      return {
        hero,
        score: winProb,
        confidence,
        breakdown: {
          strength: heroStrength,
          winProbability: winProb,
        },
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

    // Confidence: worst Wilson score across all 6 heroes
    let worstConfidence: 'high' | 'medium' | 'low' = 'high'
    for (const hero of [...leftTeam, ...rightTeam]) {
      const stats = analysisData.heroStats[hero]
      const conf = stats
        ? wilsonConfidence(stats.wins + stats.draws * 0.5, stats.matches)
        : 'low' as const
      if (conf === 'low') { worstConfidence = 'low'; break }
      if (conf === 'medium' && worstConfidence === 'high') worstConfidence = 'medium'
    }

    const allHeroSet = new Set([...leftTeam, ...rightTeam])
    const notes: MatchNote[] = []
    for (const match of matches) {
      for (const note of match.notes) {
        if (note.heroes.length > 0 && note.heroes.every((h) => allHeroSet.has(h))) {
          notes.push(note)
        }
      }
    }

    return {
      leftWinProbability: leftProb,
      rightWinProbability: 1 - leftProb,
      confidence: worstConfidence,
      breakdown: { leftStrength, rightStrength },
      relevantNotes: notes,
    }
  },
}
