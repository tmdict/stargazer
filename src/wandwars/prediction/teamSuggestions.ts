import { getAdaptiveAggregateWeights } from '../constants'
import type { AnalysisData, MatchResult } from '../types'
import { adaptiveMLModel, predictVsAverage as nnPredictVsAverage } from './adaptiveML'
import { bradleyTerryModel, getCachedBradleyTerryFit, type BradleyTerryFit } from './bradleyTerry'
import { compositeModel } from './composite'
import { NN_WEIGHTS } from './nnWeights'
import { popularPickModel } from './popularPick'
import { getAnalysisData, getMatchData } from './recommend'

export interface TeamSuggestion {
  team: [string, string, string]
  wins: number
  losses: number
  draws: number
  total: number
  winRate: number
  constructed: boolean
}

const MAX_SUGGESTIONS = 3
const PRIOR = 3.0
const MIN_MATCHES = 2

/**
 * Get exact trio records from match data.
 */
function getExactTrios(teammates: string[], matches: MatchResult[]): TeamSuggestion[] {
  const teamRecords = new Map<string, TeamSuggestion>()

  for (const match of matches) {
    for (const team of [match.left, match.right] as const) {
      if (!teammates.every((t) => team.includes(t))) continue

      const key = [...team].sort().join(',')

      if (!teamRecords.has(key)) {
        teamRecords.set(key, {
          team: [...team] as [string, string, string],
          wins: 0,
          losses: 0,
          draws: 0,
          total: 0,
          winRate: 0,
          constructed: false,
        })
      }

      const record = teamRecords.get(key)!
      record.total++

      const isLeft = team === match.left
      if ((isLeft && match.result === 'left') || (!isLeft && match.result === 'right'))
        record.wins++
      else if ((isLeft && match.result === 'right') || (!isLeft && match.result === 'left'))
        record.losses++
      else record.draws++
    }
  }

  const results: TeamSuggestion[] = []
  for (const record of teamRecords.values()) {
    record.winRate = (record.wins + PRIOR) / (record.total + 2 * PRIOR)
    if (record.total >= MIN_MATCHES && record.wins > record.losses) {
      results.push(record)
    }
  }

  return results
}

// ---- Per-model "team quality" scoring for the 1-teammate case ----
// Each function returns a [0, 1] probability that [a, b, c] is a strong trio
// against a generic opponent. Used only when we need to enumerate all
// (i, j) pairs completing a single known teammate — `predictMatchup`
// requires a specific opponent and `recommend` can't efficiently score all
// 2-hero extensions at once.

function bradleyTerryTeamQuality(
  team: [string, string, string],
  fit: BradleyTerryFit,
  avgOppStrength: number,
): number {
  const strength = team.reduce((s, h) => s + (fit.strengths.get(h) || 1), 0)
  const base = strength / (strength + avgOppStrength)
  // Pair-interaction adjustments (same residuals used in predictMatchup)
  let pairAdj = 0
  for (let i = 0; i < team.length; i++) {
    for (let j = i + 1; j < team.length; j++) {
      const key = [team[i]!, team[j]!].sort().join(',')
      pairAdj += fit.interactions.get(key) || 0
    }
  }
  return Math.max(0.05, Math.min(0.95, base + pairAdj))
}

function compositeTeamQuality(team: [string, string, string], analysis: AnalysisData): number {
  // Average individual Bayesian-smoothed win rate + pairwise synergy + trio bonus
  let base = 0
  for (const h of team) base += analysis.heroStats[h]?.winRate ?? 0.5
  base /= 3

  let synergy = 0
  for (let i = 0; i < team.length; i++) {
    for (let j = i + 1; j < team.length; j++) {
      synergy += analysis.synergyMatrix[team[i]!]?.[team[j]!]?.score ?? 0
    }
  }

  const trioKey = [...team].sort().join(',')
  const trio = analysis.trioMatrix[trioKey]
  const trioBonus = trio && trio.matches >= 3 ? trio.score : 0

  // Clamp to [0.05, 0.95] to match other models' ranges.
  return Math.max(0.05, Math.min(0.95, base + synergy / 3 + trioBonus))
}

function popularPickTeamQuality(team: [string, string, string], analysis: AnalysisData): number {
  // Average individual win rate + average pairwise win rate (from synergy
  // matrix's pair records — same underlying pair stats, just reused here).
  let indiv = 0
  for (const h of team) indiv += analysis.heroStats[h]?.winRate ?? 0.5
  indiv /= 3

  let pairTotal = 0
  let pairCount = 0
  for (let i = 0; i < team.length; i++) {
    for (let j = i + 1; j < team.length; j++) {
      const entry = analysis.synergyMatrix[team[i]!]?.[team[j]!]
      if (!entry || entry.matches === 0) continue
      // Convert synergy score (delta from avg individual rate) back to
      // absolute pair win rate by adding the pair's individual avg.
      const pairIndivAvg =
        ((analysis.heroStats[team[i]!]?.winRate ?? 0.5) +
          (analysis.heroStats[team[j]!]?.winRate ?? 0.5)) /
        2
      pairTotal += pairIndivAvg + entry.score
      pairCount++
    }
  }

  if (pairCount === 0) return indiv
  const pairAvg = pairTotal / pairCount
  return 0.4 * indiv + 0.6 * pairAvg
}

/**
 * Score candidates using all 4 models aggregated, for the 2-teammate case.
 * Each model scores all available heroes as the 3rd pick, then we aggregate.
 */
function aggregateThirdPickScores(teammates: string[], available: string[]): Map<string, number> {
  const analysis = getAnalysisData()
  const matches = getMatchData()
  const weights = getAdaptiveAggregateWeights(matches.length)

  const models = [
    { id: 'popular-pick', model: popularPickModel },
    { id: 'composite', model: compositeModel },
    { id: 'bradley-terry', model: bradleyTerryModel },
    { id: 'adaptive-ml', model: adaptiveMLModel },
  ]

  // Get recommendations from each model (opponents unknown)
  const modelRecs: { id: string; recs: Map<string, number> }[] = []
  for (const { id, model } of models) {
    const recs = model.recommend(teammates, [], available, analysis, matches)
    const scoreMap = new Map<string, number>()
    for (const rec of recs) scoreMap.set(rec.hero, rec.score)
    modelRecs.push({ id, recs: scoreMap })
  }

  // Aggregate scores per hero
  const aggregated = new Map<string, number>()
  let totalWeight = 0
  for (const { id } of modelRecs) totalWeight += weights[id] || 0

  for (const hero of available) {
    let score = 0
    for (const { id, recs } of modelRecs) {
      const w = (weights[id] || 0) / totalWeight
      score += w * (recs.get(hero) || 0.5)
    }
    aggregated.set(hero, score)
  }

  return aggregated
}

// ---- Constructed team generation ----

function getConstructedTeams(
  teammates: string[],
  allHeroes: string[],
  existingKeys: Set<string>,
  excludeHeroes: string[],
): TeamSuggestion[] {
  const excluded = new Set([...excludeHeroes, ...teammates])
  const candidates = allHeroes.filter((h) => !excluded.has(h))
  const results: TeamSuggestion[] = []

  if (teammates.length === 1) {
    // Score each candidate trio (teammate, i, j) via all 4 models, aggregated
    // using the same weights as the match prediction. Per-model scorers are
    // cheap (O(1) pair/trio lookups or a single forward pass) so enumerating
    // ~3–5k trios stays well under 100ms.
    const analysis = getAnalysisData()
    const matches = getMatchData()
    const weights = getAdaptiveAggregateWeights(matches.length)
    const btFit = getCachedBradleyTerryFit(matches, analysis)
    const avgStrength =
      [...btFit.strengths.values()].reduce((s, v) => s + v, 0) / btFit.strengths.size
    const avgOppStrength = avgStrength * 3

    const totalWeight =
      (weights['popular-pick'] || 0) +
      (weights['composite'] || 0) +
      (weights['bradley-terry'] || 0) +
      (weights['adaptive-ml'] || 0)

    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        const team = [teammates[0]!, candidates[i]!, candidates[j]!].sort() as [
          string,
          string,
          string,
        ]
        const key = team.join(',')
        if (existingKeys.has(key)) continue

        const ppScore = popularPickTeamQuality(team, analysis)
        const compositeScore = compositeTeamQuality(team, analysis)
        const btScore = bradleyTerryTeamQuality(team, btFit, avgOppStrength)
        const nnScore = nnPredictVsAverage(team)

        const winRate =
          ((weights['popular-pick'] || 0) * ppScore +
            (weights['composite'] || 0) * compositeScore +
            (weights['bradley-terry'] || 0) * btScore +
            (weights['adaptive-ml'] || 0) * nnScore) /
          totalWeight

        results.push({ team, wins: 0, losses: 0, draws: 0, total: 0, winRate, constructed: true })
      }
    }
  }

  if (teammates.length === 2) {
    // 2 teammates: aggregate all 4 models for the 3rd pick
    const scores = aggregateThirdPickScores(teammates, candidates)

    for (const third of candidates) {
      const team = [...teammates, third].sort() as [string, string, string]
      const key = team.join(',')
      if (existingKeys.has(key)) continue

      const winRate = scores.get(third) || 0.5
      results.push({ team, wins: 0, losses: 0, draws: 0, total: 0, winRate, constructed: true })
    }
  }

  return results.sort((a, b) => b.winRate - a.winRate).slice(0, MAX_SUGGESTIONS)
}

// ---- Public API ----

export interface TopTeamsResult {
  dataTeams: TeamSuggestion[]
  suggestedTeams: TeamSuggestion[]
}

function filterExcluded(teams: TeamSuggestion[], excludeHeroes: string[]): TeamSuggestion[] {
  if (excludeHeroes.length === 0) return teams
  const excluded = new Set(excludeHeroes)
  return teams.filter((t) => !t.team.some((h) => excluded.has(h)))
}

export function getTopTeams(
  teammates: string[],
  matches: MatchResult[],
  excludeHeroes: string[] = [],
): TopTeamsResult {
  if (teammates.length === 0) return { dataTeams: [], suggestedTeams: [] }

  const excludeOthers = excludeHeroes.filter((h) => !teammates.includes(h))

  const exact = getExactTrios(teammates, matches)
  const dataTeams = filterExcluded(exact, excludeOthers)
    .sort((a, b) => b.winRate - a.winRate || b.total - a.total)
    .slice(0, MAX_SUGGESTIONS)

  const existingKeys = new Set(exact.map((t) => [...t.team].sort().join(',')))
  const allHeroes = Object.keys(NN_WEIGHTS.heroIndex)
  const suggestedTeams = getConstructedTeams(teammates, allHeroes, existingKeys, excludeOthers)

  return { dataTeams, suggestedTeams }
}
