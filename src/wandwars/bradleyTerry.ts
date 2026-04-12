import {
  BT_CONVERGENCE_TOLERANCE,
  BT_MAX_ITERATIONS,
  CONFIDENCE_HIGH,
  CONFIDENCE_MEDIUM,
  MAX_RECOMMENDATIONS,
} from './constants'
import type { AnalysisData, MatchNote, MatchResult, MatchupPrediction, Recommendation, RecommendationModel } from './types'

interface BTMatch {
  leftHeroes: string[]
  rightHeroes: string[]
  leftWeight: number
  rightWeight: number
}

function prepareMatches(matches: MatchResult[]): BTMatch[] {
  return matches
    .filter((m) => m.result !== 'draw')
    .map((m) => ({
      leftHeroes: [...m.left],
      rightHeroes: [...m.right],
      leftWeight: m.result === 'left' ? m.weight : 0,
      rightWeight: m.result === 'right' ? m.weight : 0,
    }))
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

        if (isLeft) {
          totalWins += match.leftWeight
          denomSum += (match.leftWeight + match.rightWeight) / totalStrength
        }
        if (isRight) {
          totalWins += match.rightWeight
          denomSum += (match.leftWeight + match.rightWeight) / totalStrength
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

    // Compute base win probability without candidate (if teammates exist)
    // For scoring, we evaluate each candidate's marginal contribution
    const recommendations: Recommendation[] = available.map((hero) => {
      const candidateTeam = [...teammates, hero]
      // If we know opponents, predict against them; otherwise just use strength
      let winProb: number
      if (opponents.length > 0) {
        winProb = predictWinProbability(candidateTeam, opponents, strengths)
      } else {
        // No opponents known: use team strength as proportion of total
        const teamStrength = candidateTeam.reduce(
          (sum, h) => sum + (strengths.get(h) || 1),
          0,
        )
        // Normalize against average opponent team
        const avgHeroStrength = 1.0 // strengths are normalized to avg 1.0
        const avgOpponentStrength = avgHeroStrength * 3
        winProb = teamStrength / (teamStrength + avgOpponentStrength)
      }

      const heroStrength = strengths.get(hero) || 1.0
      const heroMatches = analysisData.heroStats[hero]?.matches || 0

      let confidence: 'high' | 'medium' | 'low'
      if (heroMatches >= CONFIDENCE_HIGH) confidence = 'high'
      else if (heroMatches >= CONFIDENCE_MEDIUM) confidence = 'medium'
      else confidence = 'low'

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

    // Confidence: minimum match count across all 6 heroes
    let minMatches = Infinity
    for (const hero of [...leftTeam, ...rightTeam]) {
      const heroMatches = analysisData.heroStats[hero]?.matches || 0
      minMatches = Math.min(minMatches, heroMatches)
    }
    let confidence: 'high' | 'medium' | 'low'
    if (minMatches >= CONFIDENCE_HIGH) confidence = 'high'
    else if (minMatches >= CONFIDENCE_MEDIUM) confidence = 'medium'
    else confidence = 'low'

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
      confidence,
      breakdown: { leftStrength, rightStrength },
      relevantNotes: notes,
    }
  },
}
