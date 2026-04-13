import type {
  AnalysisData,
  CounterMatrix,
  HeroStats,
  MatchResult,
  SynergyMatrix,
} from './types'

const BAYESIAN_PRIOR = 1.0

function computeHeroStats(matches: MatchResult[], allHeroes: string[]): Record<string, HeroStats> {
  const stats: Record<string, HeroStats> = {}

  for (const hero of allHeroes) {
    stats[hero] = {
      name: hero,
      matches: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      weightedWins: 0,
      weightedLosses: 0,
      winRate: 0.5,
    }
  }

  for (const match of matches) {
    const leftHeroes = match.left
    const rightHeroes = match.right

    for (const hero of leftHeroes) {
      if (!stats[hero]) continue
      stats[hero].matches++
      if (match.result === 'left') {
        stats[hero].wins++
        stats[hero].weightedWins += match.weight
      } else if (match.result === 'right') {
        stats[hero].losses++
        stats[hero].weightedLosses += match.weight
      } else {
        stats[hero].draws++
      }
    }

    for (const hero of rightHeroes) {
      if (!stats[hero]) continue
      stats[hero].matches++
      if (match.result === 'right') {
        stats[hero].wins++
        stats[hero].weightedWins += match.weight
      } else if (match.result === 'left') {
        stats[hero].losses++
        stats[hero].weightedLosses += match.weight
      } else {
        stats[hero].draws++
      }
    }
  }

  // Apply Bayesian smoothing
  for (const hero of allHeroes) {
    const s = stats[hero]
    const totalWeighted = s.weightedWins + s.weightedLosses
    s.winRate = (s.weightedWins + BAYESIAN_PRIOR) / (totalWeighted + 2 * BAYESIAN_PRIOR)
  }

  return stats
}

function computeSynergyMatrix(
  matches: MatchResult[],
  heroStats: Record<string, HeroStats>,
): SynergyMatrix {
  const pairWeightedWins: Record<string, number> = {}
  const pairWeightedTotal: Record<string, number> = {}
  const pairMatches: Record<string, number> = {}
  const pairWins: Record<string, number> = {}
  const pairLosses: Record<string, number> = {}

  for (const match of matches) {
    for (const team of [match.left, match.right] as const) {
      const isWin =
        (team === match.left && match.result === 'left') ||
        (team === match.right && match.result === 'right')
      const isLoss =
        (team === match.left && match.result === 'right') ||
        (team === match.right && match.result === 'left')

      for (let i = 0; i < team.length; i++) {
        for (let j = i + 1; j < team.length; j++) {
          const key = [team[i], team[j]].sort().join(':')
          pairMatches[key] = (pairMatches[key] || 0) + 1
          pairWeightedTotal[key] = (pairWeightedTotal[key] || 0) + match.weight
          if (isWin) {
            pairWins[key] = (pairWins[key] || 0) + 1
            pairWeightedWins[key] = (pairWeightedWins[key] || 0) + match.weight
          }
          if (isLoss) pairLosses[key] = (pairLosses[key] || 0) + 1
        }
      }
    }
  }

  const matrix: SynergyMatrix = {}

  for (const [key, matchCount] of Object.entries(pairMatches)) {
    const [a, b] = key.split(':')
    const weightedWins = pairWeightedWins[key] || 0
    const weightedTotal = pairWeightedTotal[key] || 0
    const losses = pairLosses[key] || 0

    // Bayesian-smoothed pair win rate
    const pairWinRate = (weightedWins + BAYESIAN_PRIOR) / (weightedTotal + 2 * BAYESIAN_PRIOR)
    const avgIndividualRate = ((heroStats[a]?.winRate || 0.5) + (heroStats[b]?.winRate || 0.5)) / 2
    const score = pairWinRate - avgIndividualRate

    const entry = { matches: matchCount, wins: pairWins[key] || 0, losses, score }

    if (!matrix[a]) matrix[a] = {}
    if (!matrix[b]) matrix[b] = {}
    matrix[a][b] = entry
    matrix[b][a] = entry
  }

  return matrix
}

function computeCounterMatrix(
  matches: MatchResult[],
  heroStats: Record<string, HeroStats>,
): CounterMatrix {
  const vsWeightedWins: Record<string, number> = {}
  const vsWeightedTotal: Record<string, number> = {}
  const vsMatches: Record<string, number> = {}
  const vsWins: Record<string, number> = {}
  const vsLosses: Record<string, number> = {}

  for (const match of matches) {
    for (const myHero of match.left) {
      for (const oppHero of match.right) {
        const key = `${myHero}:${oppHero}`
        vsMatches[key] = (vsMatches[key] || 0) + 1
        vsWeightedTotal[key] = (vsWeightedTotal[key] || 0) + match.weight
        if (match.result === 'left') {
          vsWins[key] = (vsWins[key] || 0) + 1
          vsWeightedWins[key] = (vsWeightedWins[key] || 0) + match.weight
        }
        if (match.result === 'right') vsLosses[key] = (vsLosses[key] || 0) + 1
      }
    }
    for (const myHero of match.right) {
      for (const oppHero of match.left) {
        const key = `${myHero}:${oppHero}`
        vsMatches[key] = (vsMatches[key] || 0) + 1
        vsWeightedTotal[key] = (vsWeightedTotal[key] || 0) + match.weight
        if (match.result === 'right') {
          vsWins[key] = (vsWins[key] || 0) + 1
          vsWeightedWins[key] = (vsWeightedWins[key] || 0) + match.weight
        }
        if (match.result === 'left') vsLosses[key] = (vsLosses[key] || 0) + 1
      }
    }
  }

  const matrix: CounterMatrix = {}

  for (const [key, matchCount] of Object.entries(vsMatches)) {
    const [hero, opponent] = key.split(':')
    const weightedWins = vsWeightedWins[key] || 0
    const weightedTotal = vsWeightedTotal[key] || 0
    const wins = vsWins[key] || 0
    const losses = vsLosses[key] || 0

    // Bayesian-smoothed counter win rate
    const vsWinRate = (weightedWins + BAYESIAN_PRIOR) / (weightedTotal + 2 * BAYESIAN_PRIOR)
    const overallRate = heroStats[hero]?.winRate || 0.5
    const score = vsWinRate - overallRate

    if (!matrix[hero]) matrix[hero] = {}
    matrix[hero][opponent] = { matches: matchCount, wins, losses, score }
  }

  return matrix
}

export function analyzeMatches(matches: MatchResult[], allHeroes: string[]): AnalysisData {
  const heroStats = computeHeroStats(matches, allHeroes)
  const synergyMatrix = computeSynergyMatrix(matches, heroStats)
  const counterMatrix = computeCounterMatrix(matches, heroStats)

  return {
    heroStats,
    synergyMatrix,
    counterMatrix,
    allHeroes,
    totalMatches: matches.length,
  }
}
