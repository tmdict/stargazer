import {
  CONFIDENCE_HIGH,
  CONFIDENCE_MEDIUM,
  MAX_RECOMMENDATIONS,
  WEIGHT_BASE,
  WEIGHT_COUNTER,
  WEIGHT_SYNERGY,
} from './constants'
import type { AnalysisData, MatchNote, MatchResult, MatchupPrediction, Recommendation, RecommendationModel } from './types'

function getConfidence(relevantMatches: number): 'high' | 'medium' | 'low' {
  if (relevantMatches >= CONFIDENCE_HIGH) return 'high'
  if (relevantMatches >= CONFIDENCE_MEDIUM) return 'medium'
  return 'low'
}

function computeSynergy(candidate: string, teammates: string[], data: AnalysisData): number {
  let total = 0
  for (const mate of teammates) {
    total += data.synergyMatrix[candidate]?.[mate]?.score || 0
  }
  return total
}

function computeCounter(candidate: string, opponents: string[], data: AnalysisData): number {
  let total = 0
  for (const opp of opponents) {
    total += data.counterMatrix[candidate]?.[opp]?.score || 0
  }
  return total
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

function getRelevantMatchCount(
  candidate: string,
  teammates: string[],
  opponents: string[],
  data: AnalysisData,
): number {
  let count = data.heroStats[candidate]?.matches || 0
  for (const mate of teammates) {
    count = Math.min(count, data.synergyMatrix[candidate]?.[mate]?.matches || 0)
  }
  for (const opp of opponents) {
    count = Math.min(count, data.counterMatrix[candidate]?.[opp]?.matches || 0)
  }
  return count
}

export const compositeModel: RecommendationModel = {
  id: 'composite',
  name: 'Composite',

  recommend(
    teammates: string[],
    opponents: string[],
    available: string[],
    analysisData: AnalysisData,
    matches: MatchResult[],
  ): Recommendation[] {
    const recommendations: Recommendation[] = available.map((hero) => {
      const baseWinRate = analysisData.heroStats[hero]?.winRate || 0.5
      const synergy = computeSynergy(hero, teammates, analysisData)
      const counter = computeCounter(hero, opponents, analysisData)

      const score =
        WEIGHT_BASE * baseWinRate + WEIGHT_SYNERGY * synergy + WEIGHT_COUNTER * counter

      const relevantMatches = getRelevantMatchCount(hero, teammates, opponents, analysisData)

      return {
        hero,
        score,
        confidence: getConfidence(relevantMatches),
        breakdown: {
          base: baseWinRate,
          synergy,
          counter,
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
    function teamScore(team: string[], opponents: string[]): number {
      let total = 0
      for (const hero of team) {
        const base = analysisData.heroStats[hero]?.winRate || 0.5
        const synergy = computeSynergy(hero, team.filter((h) => h !== hero), analysisData)
        const counter = computeCounter(hero, opponents, analysisData)
        total += WEIGHT_BASE * base + WEIGHT_SYNERGY * synergy + WEIGHT_COUNTER * counter
      }
      return total
    }

    const leftScore = teamScore(leftTeam, rightTeam)
    const rightScore = teamScore(rightTeam, leftTeam)
    const total = leftScore + rightScore
    const leftProb = total > 0 ? leftScore / total : 0.5

    // Confidence: minimum relevant match count across all heroes
    let minMatches = Infinity
    for (const hero of [...leftTeam, ...rightTeam]) {
      const opponents = leftTeam.includes(hero) ? rightTeam : leftTeam
      const teammates = (leftTeam.includes(hero) ? leftTeam : rightTeam).filter((h) => h !== hero)
      minMatches = Math.min(minMatches, getRelevantMatchCount(hero, teammates, opponents, analysisData))
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
      confidence: getConfidence(minMatches === Infinity ? 0 : minMatches),
      breakdown: { leftScore, rightScore },
      relevantNotes: notes,
    }
  },
}
