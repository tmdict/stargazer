import { wilsonConfidence } from './confidence'
import {
  MAX_RECOMMENDATIONS,
  SAMPLE_BONUS_FULL,
  SAMPLE_BONUS_MAX,
  WEIGHT_BASE,
  WEIGHT_COUNTER,
  WEIGHT_SYNERGY,
} from './constants'
import { getMatchupNotes, getRelevantNotes, getWorstConfidence } from './modelUtils'
import type {
  AnalysisData,
  MatchResult,
  MatchupPrediction,
  Recommendation,
  RecommendationModel,
} from './types'

function normalizeModifier(value: number): number {
  const clamped = Math.max(-0.5, Math.min(0.5, value))
  return clamped + 0.5
}

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

function synergyDataStrength(candidate: string, teammates: string[], data: AnalysisData): number {
  if (teammates.length === 0) return 0
  let total = 0
  for (const mate of teammates) {
    total += dataStrength(data.synergyMatrix[candidate]?.[mate]?.matches || 0)
  }
  return total / teammates.length
}

function counterDataStrength(candidate: string, opponents: string[], data: AnalysisData): number {
  if (opponents.length === 0) return 0
  let total = 0
  for (const opp of opponents) {
    total += dataStrength(data.counterMatrix[candidate]?.[opp]?.matches || 0)
  }
  return total / opponents.length
}

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
  const effectiveSynergyWeight = WEIGHT_SYNERGY * synStrength
  const effectiveCounterWeight = WEIGHT_COUNTER * ctrStrength
  // Redistribute unused synergy/counter weight to base win rate
  const effectiveBaseWeight =
    WEIGHT_BASE +
    (WEIGHT_SYNERGY - effectiveSynergyWeight) +
    (WEIGHT_COUNTER - effectiveCounterWeight)

  return (
    effectiveBaseWeight * baseWinRate +
    effectiveSynergyWeight * normalizeModifier(rawSynergy) +
    effectiveCounterWeight * normalizeModifier(rawCounter) +
    sampleBonus(heroMatches)
  )
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

  const synStr = synergyDataStrength(candidate, teammates, data)
  const ctrStr = counterDataStrength(candidate, opponents, data)
  const pairStrength =
    teammates.length > 0 || opponents.length > 0
      ? (synStr + ctrStr) / (teammates.length > 0 && opponents.length > 0 ? 2 : 1)
      : 1

  if (pairStrength < 0.3 && (teammates.length > 0 || opponents.length > 0)) {
    return heroConf === 'high' ? 'medium' : 'low'
  }

  return heroConf
}

export const compositeModel: RecommendationModel = {
  id: 'composite',
  name: 'Hero Synergy (Composite)',

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
      const score = computeDynamicScore(
        baseWinRate,
        rawSynergy,
        rawCounter,
        synStr,
        ctrStr,
        heroMatches,
      )
      const pickRate = analysisData.totalMatches > 0 ? heroMatches / analysisData.totalMatches : 0

      return {
        hero,
        score,
        confidence: getHeroConfidence(hero, teammates, opponents, analysisData),
        breakdown: { base: baseWinRate, synergy: rawSynergy, counter: rawCounter, pickRate },
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

    const confidence = getWorstConfidence([...leftTeam, ...rightTeam], analysisData, (hero) => {
      const opponents = leftTeam.includes(hero) ? rightTeam : leftTeam
      const teammates = (leftTeam.includes(hero) ? leftTeam : rightTeam).filter((h) => h !== hero)
      return getHeroConfidence(hero, teammates, opponents, analysisData)
    })

    return {
      leftWinProbability: leftProb,
      rightWinProbability: 1 - leftProb,
      confidence,
      breakdown: { leftScore, rightScore },
      relevantNotes: getMatchupNotes(leftTeam, rightTeam, matches),
    }
  },
}
