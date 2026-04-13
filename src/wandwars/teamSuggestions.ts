import type { MatchResult } from './types'

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
const PRIOR = 1.0

/**
 * Compute pair win record between two heroes on the same team.
 */
function getPairRecord(
  heroA: string,
  heroB: string,
  matches: MatchResult[],
): { wins: number; losses: number; total: number; winRate: number } {
  let wins = 0
  let losses = 0
  let total = 0

  for (const match of matches) {
    for (const team of [match.left, match.right] as const) {
      if (!team.includes(heroA) || !team.includes(heroB)) continue
      total++
      const isLeft = team === match.left
      if ((isLeft && match.result === 'left') || (!isLeft && match.result === 'right')) wins++
      else if ((isLeft && match.result === 'right') || (!isLeft && match.result === 'left'))
        losses++
    }
  }

  return {
    wins,
    losses,
    total,
    winRate: (wins + PRIOR) / (total + 2 * PRIOR),
  }
}

/**
 * Find all unique heroes that have appeared on a team with a given hero.
 */
function findPairPartners(hero: string, matches: MatchResult[]): string[] {
  const partners = new Set<string>()
  for (const match of matches) {
    for (const team of [match.left, match.right] as const) {
      if (!team.includes(hero)) continue
      for (const h of team) {
        if (h !== hero) partners.add(h)
      }
    }
  }
  return [...partners]
}

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
    // Only include teams with more wins than losses
    if (record.wins > record.losses) {
      results.push(record)
    }
  }

  return results
}

/**
 * Construct teams from best pair combinations.
 * Uses individual pair records — does NOT require the trio to have appeared together.
 */
function getConstructedTeams(
  teammates: string[],
  matches: MatchResult[],
  existingKeys: Set<string>,
): TeamSuggestion[] {
  const results: TeamSuggestion[] = []

  if (teammates.length === 1) {
    const hero = teammates[0]!
    // Find all partners of hero, ranked by pair win rate
    const partners = findPairPartners(hero, matches)
    const rankedPartners = partners
      .map((p) => ({ hero: p, ...getPairRecord(hero, p, matches) }))
      .sort((a, b) => b.winRate - a.winRate || b.total - a.total)
      .slice(0, 8)

    for (const partner of rankedPartners) {
      // For each top partner, find best third by average pair win rate with both
      const thirdCandidates = findPairPartners(partner.hero, matches).filter(
        (h) => h !== hero && h !== partner.hero,
      )

      for (const third of thirdCandidates) {
        const team = [hero, partner.hero, third].sort() as [string, string, string]
        const key = team.join(',')
        if (existingKeys.has(key)) continue

        const pair1 = getPairRecord(hero, partner.hero, matches)
        const pair2 = getPairRecord(hero, third, matches)
        const pair3 = getPairRecord(partner.hero, third, matches)

        // Need at least some pair data
        if (pair2.total === 0 && pair3.total === 0) continue

        const totalWins = pair1.wins + pair2.wins + pair3.wins
        const totalLosses = pair1.losses + pair2.losses + pair3.losses
        const totalMatches = pair1.total + pair2.total + pair3.total
        const estimatedWinRate = (totalWins + PRIOR) / (totalMatches + 2 * PRIOR)

        existingKeys.add(key)
        results.push({
          team: [hero, partner.hero, third] as [string, string, string],
          wins: totalWins,
          losses: totalLosses,
          draws: 0,
          total: totalMatches,
          winRate: estimatedWinRate,
          constructed: true,
        })
      }
    }
  }

  if (teammates.length === 2) {
    // Find best third hero by pair records with each teammate independently
    const allPartners = new Set([
      ...findPairPartners(teammates[0]!, matches),
      ...findPairPartners(teammates[1]!, matches),
    ])
    // Remove existing teammates
    allPartners.delete(teammates[0]!)
    allPartners.delete(teammates[1]!)

    for (const third of allPartners) {
      const team = [...teammates, third].sort() as [string, string, string]
      const key = team.join(',')
      if (existingKeys.has(key)) continue

      const pair1 = getPairRecord(teammates[0]!, third, matches)
      const pair2 = getPairRecord(teammates[1]!, third, matches)
      const pairBetween = getPairRecord(teammates[0]!, teammates[1]!, matches)

      const totalWins = pair1.wins + pair2.wins + pairBetween.wins
      const totalLosses = pair1.losses + pair2.losses + pairBetween.losses
      const totalMatches = pair1.total + pair2.total + pairBetween.total
      const estimatedWinRate = (totalWins + PRIOR) / (totalMatches + 2 * PRIOR)

      existingKeys.add(key)
      results.push({
        team: [teammates[0]!, teammates[1]!, third] as [string, string, string],
        wins: totalWins,
        losses: totalLosses,
        draws: 0,
        total: totalMatches,
        winRate: estimatedWinRate,
        constructed: true,
      })
    }
  }

  return results.sort((a, b) => b.winRate - a.winRate || b.total - a.total)
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
  const suggestedTeams = filterExcluded(
    getConstructedTeams(teammates, matches, existingKeys),
    excludeOthers,
  ).slice(0, MAX_SUGGESTIONS)

  return { dataTeams, suggestedTeams }
}
