import type { MatchResult } from '../types'
import { heroNamesToIndices, nnForward } from './nn'
import { NN_WEIGHTS } from './nnWeights'

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

/**
 * Compute the mean team embedding across all heroes, used as a fixed
 * "average opponent" for NN-scored team suggestions.
 */
let cachedAvgOpponent: number[] | null = null
function getAvgOpponentIndices(): number[] {
  if (cachedAvgOpponent) return cachedAvgOpponent
  const numHeroes = Object.keys(NN_WEIGHTS.heroIndex).length
  // Use 3 copies of the mean embedding index — approximated by averaging
  // predictions against a few spread-out trios
  cachedAvgOpponent = Array.from({ length: numHeroes }, (_, i) => i)
  return cachedAvgOpponent
}

/**
 * Score a trio using the NN against the average opponent pool.
 * Samples a few evenly-spaced opponent trios for a stable estimate.
 */
function nnTeamScore(teamIndices: number[]): number {
  const allIdx = getAvgOpponentIndices()
  const n = allIdx.length
  const step = Math.max(1, Math.floor(n / 6))
  let total = 0
  let count = 0
  for (let a = 0; a < n && count < 30; a += step) {
    for (let b = a + 1; b < n && count < 30; b += step) {
      for (let c = b + 1; c < n && count < 30; c += step) {
        if (teamIndices.includes(a) || teamIndices.includes(b) || teamIndices.includes(c)) continue
        total += nnForward(NN_WEIGHTS, teamIndices, [allIdx[a]!, allIdx[b]!, allIdx[c]!])
        count++
      }
    }
  }
  return count > 0 ? total / count : 0.5
}

/**
 * Construct teams scored by the Adaptive ML neural network.
 * Evaluates all possible trios containing the teammates — not limited
 * to heroes that have appeared together in data.
 */
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
    for (const third of candidates) {
      const team = [...teammates, third].sort() as [string, string, string]
      const key = team.join(',')
      if (existingKeys.has(key)) continue

      const indices = heroNamesToIndices(team, NN_WEIGHTS.heroIndex)
      if (indices.length !== 3) continue

      const winRate = nnTeamScore(indices)
      results.push({ team, wins: 0, losses: 0, draws: 0, total: 0, winRate, constructed: true })
    }
  }

  return results.sort((a, b) => b.winRate - a.winRate).slice(0, MAX_SUGGESTIONS)
}

export interface TopTeamsResult {
  dataTeams: TeamSuggestion[]
  suggestedTeams: TeamSuggestion[]
}

/**
 * Find top teams: up to 3 real teams from data, plus up to 3 constructed
 * teams from pair combinations. Returned separately.
 */
/**
 * Filter out teams containing any excluded hero (already picked by either side).
 */
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

  // Exclude heroes already picked (teammates are allowed since they're on the team)
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
