import {
  MAX_RECOMMENDATIONS,
  SAMPLE_BONUS_FULL,
  SAMPLE_BONUS_MAX,
  WEIGHT_BASE,
  WEIGHT_COUNTER,
  WEIGHT_SYNERGY,
} from './constants'
import { wilsonConfidence } from './confidence'
import type { AnalysisData, MatchNote, MatchResult, MatchupPrediction, Recommendation, RecommendationModel } from './types'

// Clamp synergy/counter sums to [-0.5, 0.5] then shift to [0, 1] for normalization
function normalizeModifier(value: number): number {
  const clamped = Math.max(-0.5, Math.min(0.5, value))
  return clamped + 0.5
}

// Data strength: 0-1 scale based on how much pair data exists
// Ramps from 0 at 0 matches to 1.0 at 10+ matches (smooth sigmoid-like curve)
const DATA_STRENGTH_FULL = 10

function dataStrength(matchCount: number): number {
  if (matchCount <= 0) return 0
  return Math.min(1, matchCount / DATA_STRENGTH_FULL)
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

// Average pair data strength across all teammate pairs
function synergyDataStrength(candidate: string, teammates: string[], data: AnalysisData): number {
  if (teammates.length === 0) return 0
  let total = 0
  for (const mate of teammates) {
    const matches = data.synergyMatrix[candidate]?.[mate]?.matches || 0
    total += dataStrength(matches)
  }
  return total / teammates.length
}

// Average matchup data strength across all opponent matchups
function counterDataStrength(candidate: string, opponents: string[], data: AnalysisData): number {
  if (opponents.length === 0) return 0
  let total = 0
  for (const opp of opponents) {
    const matches = data.counterMatrix[candidate]?.[opp]?.matches || 0
    total += dataStrength(matches)
  }
  return total / opponents.length
}

// Sample size bonus: slight boost for well-represented heroes (tie-breaker)
function sampleBonus(heroMatches: number): number {
  return SAMPLE_BONUS_MAX * Math.min(1, heroMatches / SAMPLE_BONUS_FULL)
}

function computeDynamicScore(
  baseWinRate: number,
  rawSynergy: number,
  rawCounter: number,
  synStrength: number,
  ctrStrength: number,
  heroMatches: number,
): number {
  // Scale the ideal weights by data availability
  const effectiveSynergyWeight = WEIGHT_SYNERGY * synStrength
  const effectiveCounterWeight = WEIGHT_COUNTER * ctrStrength
  // Redistribute unused weight to base (the most reliable component)
  const effectiveBaseWeight = WEIGHT_BASE + (WEIGHT_SYNERGY - effectiveSynergyWeight) + (WEIGHT_COUNTER - effectiveCounterWeight)

  return (
    effectiveBaseWeight * baseWinRate +
    effectiveSynergyWeight * normalizeModifier(rawSynergy) +
    effectiveCounterWeight * normalizeModifier(rawCounter) +
    sampleBonus(heroMatches)
  )
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

function getHeroConfidence(
  candidate: string,
  teammates: string[],
  opponents: string[],
  data: AnalysisData,
): 'high' | 'medium' | 'low' {
  const stats = data.heroStats[candidate]
  if (!stats || stats.matches === 0) return 'low'

  const heroConf = wilsonConfidence(stats.wins + stats.draws * 0.5, stats.matches)

  // Degrade if synergy/counter data is very sparse
  const synStr = synergyDataStrength(candidate, teammates, data)
  const ctrStr = counterDataStrength(candidate, opponents, data)
  const pairStrength = teammates.length > 0 || opponents.length > 0
    ? (synStr + ctrStr) / (teammates.length > 0 && opponents.length > 0 ? 2 : 1)
    : 1

  if (pairStrength < 0.3 && (teammates.length > 0 || opponents.length > 0)) {
    return heroConf === 'high' ? 'medium' : 'low'
  }

  return heroConf
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
      const rawSynergy = computeSynergy(hero, teammates, analysisData)
      const rawCounter = computeCounter(hero, opponents, analysisData)

      const synStr = synergyDataStrength(hero, teammates, analysisData)
      const ctrStr = counterDataStrength(hero, opponents, analysisData)

      const heroMatches = analysisData.heroStats[hero]?.matches || 0
      const score = computeDynamicScore(baseWinRate, rawSynergy, rawCounter, synStr, ctrStr, heroMatches)
      const confidence = getHeroConfidence(hero, teammates, opponents, analysisData)

      const pickRate = analysisData.totalMatches > 0 ? heroMatches / analysisData.totalMatches : 0

      return {
        hero,
        score,
        confidence,
        breakdown: {
          base: baseWinRate,
          synergy: rawSynergy,
          counter: rawCounter,
          pickRate,
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
        const teammates = team.filter((h) => h !== hero)
        const rawSynergy = computeSynergy(hero, teammates, analysisData)
        const rawCounter = computeCounter(hero, opponents, analysisData)
        const synStr = synergyDataStrength(hero, teammates, analysisData)
        const ctrStr = counterDataStrength(hero, opponents, analysisData)
        const heroMatches = analysisData.heroStats[hero]?.matches || 0
        total += computeDynamicScore(base, rawSynergy, rawCounter, synStr, ctrStr, heroMatches)
      }
      return total
    }

    const leftScore = teamScore(leftTeam, rightTeam)
    const rightScore = teamScore(rightTeam, leftTeam)
    const total = leftScore + rightScore
    const leftProb = total > 0 ? leftScore / total : 0.5

    // Confidence: worst Wilson confidence across all 6 heroes
    let worstConfidence: 'high' | 'medium' | 'low' = 'high'
    for (const hero of [...leftTeam, ...rightTeam]) {
      const opponents = leftTeam.includes(hero) ? rightTeam : leftTeam
      const teammates = (leftTeam.includes(hero) ? leftTeam : rightTeam).filter((h) => h !== hero)
      const conf = getHeroConfidence(hero, teammates, opponents, analysisData)
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
      breakdown: { leftScore, rightScore },
      relevantNotes: notes,
    }
  },
}
