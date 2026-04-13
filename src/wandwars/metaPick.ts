import { MAX_RECOMMENDATIONS } from './constants'
import { wilsonConfidence } from './confidence'
import type { AnalysisData, MatchNote, MatchResult, MatchupPrediction, Recommendation, RecommendationModel } from './types'

// Tier bonuses: S-tier heroes get a small edge
const TIER_BONUS: Record<string, number> = { s: 0.06, a: 0.03, rare: 0 }

// Weights for the meta score
const WEIGHT_WIN_RATE = 0.5
const WEIGHT_PICK_RATE = 0.3
const WEIGHT_TIER = 0.2

// Minimum matches with teammates to use contextual win rate
const CONTEXT_MIN_MATCHES = 3
const BAYESIAN_PRIOR = 1.0

// Load character data for tier info
const characterModules = import.meta.glob<{ level: string; name: string }>(
  '@/data/character/*.json',
  { eager: true, import: 'default' },
)

const heroTiers: Record<string, string> = {}
for (const [path, data] of Object.entries(characterModules)) {
  const name = path.split('/').pop()?.replace('.json', '') || ''
  heroTiers[name] = data.level
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

/**
 * Compute contextual win rate: the candidate's win rate in matches
 * where all current teammates are on the same team.
 * Falls back to overall win rate when insufficient contextual data.
 * Blends between contextual and overall based on sample size.
 */
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
    // Check if candidate is in this match
    const onLeft = match.left.includes(candidate)
    const onRight = match.right.includes(candidate)
    if (!onLeft && !onRight) continue

    const candidateTeam = onLeft ? match.left : match.right
    const opposingTeam = onLeft ? match.right : match.left
    const candidateWon =
      (onLeft && match.result === 'left') || (onRight && match.result === 'right')

    // Check teammates are on the same team
    if (teammates.length > 0 && !teammates.every((t) => candidateTeam.includes(t))) continue

    // Check opponents are on the opposing team
    if (opponents.length > 0 && !opponents.every((o) => opposingTeam.includes(o))) continue

    contextTotal++
    if (candidateWon) contextWins += match.weight
    else if (match.result !== 'draw') contextTotal += match.weight - 1 // account for weighted losses
  }

  if (contextTotal < CONTEXT_MIN_MATCHES) {
    // Not enough contextual data — blend toward overall
    const blend = contextTotal / CONTEXT_MIN_MATCHES // 0-1
    return {
      winRate: blend * ((contextWins + BAYESIAN_PRIOR) / (contextTotal + 2 * BAYESIAN_PRIOR)) +
              (1 - blend) * overallWinRate,
      contextMatches: contextTotal,
    }
  }

  // Enough data — use Bayesian-smoothed contextual rate
  const contextRate = (contextWins + BAYESIAN_PRIOR) / (contextTotal + 2 * BAYESIAN_PRIOR)
  return { winRate: contextRate, contextMatches: contextTotal }
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
    const maxMatches = Math.max(
      ...available.map((h) => analysisData.heroStats[h]?.matches || 0),
      1,
    )

    const recommendations: Recommendation[] = available.map((hero) => {
      const stats = analysisData.heroStats[hero]
      const overallWinRate = stats?.winRate || 0.5
      const heroMatches = stats?.matches || 0
      const pickRate = heroMatches / analysisData.totalMatches
      const normalizedPickRate = heroMatches / maxMatches
      const tier = heroTiers[hero] || 'a'
      const tierBonus = TIER_BONUS[tier] || 0

      // Use contextual win rate when teammates/opponents are known
      const { winRate, contextMatches } = contextualWinRate(
        hero, teammates, opponents, matches, overallWinRate,
      )

      const score =
        WEIGHT_WIN_RATE * winRate +
        WEIGHT_PICK_RATE * normalizedPickRate +
        WEIGHT_TIER * (0.5 + tierBonus)

      const confidence = stats
        ? wilsonConfidence(stats.wins + stats.draws * 0.5, stats.matches)
        : 'low' as const

      return {
        hero,
        score,
        confidence,
        breakdown: {
          winRate,
          overallWinRate,
          pickRate,
          tier: tierBonus,
          contextMatches,
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
    function teamMetaScore(team: string[], opponents: string[]): number {
      let total = 0
      for (const hero of team) {
        const overallWinRate = analysisData.heroStats[hero]?.winRate || 0.5
        const teammates = team.filter((h) => h !== hero)
        const { winRate } = contextualWinRate(hero, teammates, opponents, matches, overallWinRate)
        const tier = heroTiers[hero] || 'a'
        const tierBonus = TIER_BONUS[tier] || 0
        total += winRate + tierBonus
      }
      return total
    }

    const leftScore = teamMetaScore(leftTeam, rightTeam)
    const rightScore = teamMetaScore(rightTeam, leftTeam)
    const total = leftScore + rightScore
    const leftProb = total > 0 ? leftScore / total : 0.5

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
      breakdown: { leftScore, rightScore },
      relevantNotes: notes,
    }
  },
}
