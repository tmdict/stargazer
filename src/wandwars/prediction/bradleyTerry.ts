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

// Pair interaction regularization: stronger than hero reg since pair data is sparser
const PAIR_REGULARIZATION_STRENGTH = 5.0
// Minimum pair matches before interaction contributes
const PAIR_DATA_STRENGTH_FULL = 10

/**
 * Compute pair interaction scores as residuals from the additive model.
 * For each hero pair that appears on the same team, compare their actual
 * win rate to the B-T model's prediction — the difference is the synergy
 * or clash that the additive model misses.
 */
function computePairInteractions(
  btMatches: BTMatch[],
  strengths: Map<string, number>,
): Map<string, number> {
  const pairActualWins = new Map<string, number>()
  const pairExpectedWins = new Map<string, number>()
  const pairTotalWeight = new Map<string, number>()

  for (const match of btMatches) {
    const leftS = match.leftHeroes.reduce((s, h) => s + (strengths.get(h) || 1), 0)
    const rightS = match.rightHeroes.reduce((s, h) => s + (strengths.get(h) || 1), 0)
    const totalS = leftS + rightS
    if (totalS <= 0) continue

    for (const [heroes, wins, prob] of [
      [match.leftHeroes, match.leftWeight, leftS / totalS],
      [match.rightHeroes, match.rightWeight, rightS / totalS],
    ] as [string[], number, number][]) {
      for (let i = 0; i < heroes.length; i++) {
        for (let j = i + 1; j < heroes.length; j++) {
          const key = [heroes[i]!, heroes[j]!].sort().join(',')
          const w = match.leftWeight + match.rightWeight
          pairActualWins.set(key, (pairActualWins.get(key) || 0) + wins)
          pairExpectedWins.set(key, (pairExpectedWins.get(key) || 0) + w * prob)
          pairTotalWeight.set(key, (pairTotalWeight.get(key) || 0) + w)
        }
      }
    }
  }

  const interactions = new Map<string, number>()
  for (const [key, totalWeight] of pairTotalWeight) {
    const actual = pairActualWins.get(key) || 0
    const expected = pairExpectedWins.get(key) || 0
    const dataStr = Math.min(1, totalWeight / PAIR_DATA_STRENGTH_FULL)
    const regWeight = PAIR_REGULARIZATION_STRENGTH / (1 + totalWeight)
    // Residual: how much better (positive) or worse (negative) than expected
    const residual = (actual - expected) / (totalWeight + regWeight)
    // Clamp to ±5% per pair — 3 pairs per team means ±15% max team adjustment
    const clamped = Math.max(-0.05, Math.min(0.05, residual * dataStr))
    interactions.set(key, clamped)
  }

  return interactions
}

function teamPairAdjustment(team: string[], interactions: Map<string, number>): number {
  let adj = 0
  for (let i = 0; i < team.length; i++) {
    for (let j = i + 1; j < team.length; j++) {
      const key = [team[i]!, team[j]!].sort().join(',')
      adj += interactions.get(key) || 0
    }
  }
  return adj
}

function predictWinProbability(
  leftTeam: string[],
  rightTeam: string[],
  strengths: Map<string, number>,
  interactions?: Map<string, number>,
): number {
  const leftStrength = leftTeam.reduce((sum, h) => sum + (strengths.get(h) || 1), 0)
  const rightStrength = rightTeam.reduce((sum, h) => sum + (strengths.get(h) || 1), 0)
  const total = leftStrength + rightStrength
  const baseProb = total > 0 ? leftStrength / total : 0.5

  if (!interactions) return baseProb

  const leftAdj = teamPairAdjustment(leftTeam, interactions)
  const rightAdj = teamPairAdjustment(rightTeam, interactions)
  return Math.max(0.05, Math.min(0.95, baseProb + leftAdj - rightAdj))
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

export interface BradleyTerryFit {
  strengths: Map<string, number>
  interactions: Map<string, number>
  predict(leftTeam: string[], rightTeam: string[]): number
}

/**
 * Fit Bradley-Terry strengths + pair interaction residuals for a given match
 * set and analysis snapshot. Returns a reusable fit that can be called many
 * times without refitting — used by the benchmark to cache per-fold fits,
 * and by the production model paths below.
 *
 * For the production app, prefer `getCachedBradleyTerryFit` — the fit is
 * deterministic for given match data, so refitting on every hero pick is
 * wasted work. The benchmark deliberately calls this function directly to
 * keep per-fold fits independent.
 */
export function fitBradleyTerry(
  matches: MatchResult[],
  analysisData: AnalysisData,
): BradleyTerryFit {
  const btMatches = prepareMatches(matches)
  const matchCounts = buildMatchCountMap(analysisData)
  const strengths = fitParameters(btMatches, analysisData.allHeroes, matchCounts)
  const interactions = computePairInteractions(btMatches, strengths)
  return {
    strengths,
    interactions,
    predict: (left, right) => predictWinProbability(left, right, strengths, interactions),
  }
}

// ---- Session-scoped cache ----
// Match data is static for the lifetime of a browser session (inlined at
// build time, recorded matches live separately in localStorage), so one fit
// is reusable across every call site. Reference identity on `matches` is a
// sufficient invalidation key — if the array reference ever changes (new
// data bundled in a fresh build, HMR reload, future "include recorded
// matches" feature), the next caller refits automatically.

let cachedFit: BradleyTerryFit | null = null
let cachedMatchesRef: MatchResult[] | null = null

export function getCachedBradleyTerryFit(
  matches: MatchResult[],
  analysisData: AnalysisData,
): BradleyTerryFit {
  if (cachedFit && cachedMatchesRef === matches) return cachedFit
  cachedFit = fitBradleyTerry(matches, analysisData)
  cachedMatchesRef = matches
  return cachedFit
}

/** Force the next caller to refit. Reserved for future "merge recorded matches" features. */
export function invalidateBradleyTerryCache(): void {
  cachedFit = null
  cachedMatchesRef = null
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
    const { strengths, interactions, predict } = getCachedBradleyTerryFit(matches, analysisData)
    const avgOpponentStrength = computeAverageTeamStrength(strengths)

    const recommendations: Recommendation[] = available.map((hero) => {
      const candidateTeam = [...teammates, hero]
      let winProb: number
      if (opponents.length > 0) {
        winProb = predict(candidateTeam, opponents)
      } else {
        const teamStrength = candidateTeam.reduce((sum, h) => sum + (strengths.get(h) || 1), 0)
        const baseProb = teamStrength / (teamStrength + avgOpponentStrength)
        const adj = teamPairAdjustment(candidateTeam, interactions)
        winProb = Math.max(0.05, Math.min(0.95, baseProb + adj))
      }

      const pairAdj =
        teammates.length > 0 ? teamPairAdjustment([...teammates, hero], interactions) : 0

      return {
        hero,
        score: winProb,
        confidence: getHeroWilsonConfidence(analysisData.heroStats[hero]),
        breakdown: {
          strength: strengths.get(hero) || 1.0,
          winProbability: winProb,
          pairSynergy: pairAdj,
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
    const { strengths, predict } = getCachedBradleyTerryFit(matches, analysisData)
    const leftProb = predict(leftTeam, rightTeam)
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
