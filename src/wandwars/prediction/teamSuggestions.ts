import type { MatchResult } from '../types'
import { adaptiveMLModel } from './adaptiveML'
import { bradleyTerryModel } from './bradleyTerry'
import { compositeModel } from './composite'
import { heroNamesToIndices, nnForward } from './nn'
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

// ---- NN-only scoring (for 1 teammate — full trio evaluation) ----

function nnTeamScore(teamIndices: number[]): number {
  const n = Object.keys(NN_WEIGHTS.heroIndex).length
  const step = Math.max(1, Math.floor(n / 6))
  let total = 0
  let count = 0
  for (let a = 0; a < n && count < 30; a += step) {
    for (let b = a + 1; b < n && count < 30; b += step) {
      for (let c = b + 1; c < n && count < 30; c += step) {
        if (teamIndices.includes(a) || teamIndices.includes(b) || teamIndices.includes(c)) continue
        total += nnForward(NN_WEIGHTS, teamIndices, [a, b, c])
        count++
      }
    }
  }
  return count > 0 ? total / count : 0.5
}

// ---- Aggregate scoring (for 2 teammates — all 4 models) ----

/**
 * Adaptive weights matching the aggregate match prediction weights from recommend.ts
 */
function getModelWeights(matchCount: number): Record<string, number> {
  if (matchCount < 20) {
    return { 'popular-pick': 0.55, composite: 0.3, 'bradley-terry': 0.1, 'adaptive-ml': 0.05 }
  }
  if (matchCount <= 100) {
    const t = (matchCount - 20) / 80
    return {
      'popular-pick': 0.55 - 0.2 * t,
      composite: 0.3 - 0.05 * t,
      'bradley-terry': 0.1 + 0.1 * t,
      'adaptive-ml': 0.05 + 0.15 * t,
    }
  }
  const t = Math.min(1, (matchCount - 100) / 400)
  return {
    'popular-pick': 0.35 - 0.1 * t,
    composite: 0.25 - 0.05 * t,
    'bradley-terry': 0.2 + 0.05 * t,
    'adaptive-ml': 0.2 + 0.1 * t,
  }
}

/**
 * Score candidates using all 4 models aggregated, for the 2-teammate case.
 * Each model scores all available heroes as the 3rd pick, then we aggregate.
 */
function aggregateThirdPickScores(teammates: string[], available: string[]): Map<string, number> {
  const analysis = getAnalysisData()
  const matches = getMatchData()
  const weights = getModelWeights(matches.length)

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
    // 1 teammate: NN-only scoring (other models can't efficiently evaluate all pair combos)
    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        const team = [teammates[0]!, candidates[i]!, candidates[j]!].sort() as [
          string,
          string,
          string,
        ]
        const key = team.join(',')
        if (existingKeys.has(key)) continue

        const indices = heroNamesToIndices(team, NN_WEIGHTS.heroIndex)
        if (indices.length !== 3) continue

        const winRate = nnTeamScore(indices)
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
