import {
  INSIGHT_BALANCED_TOLERANCE,
  INSIGHT_NOTABLE_DEVIATION,
  INSIGHT_NOTABLE_WINRATE,
  metaMinPairMatches,
} from '@/wandwars/constants'
import { formatPercent } from '@/wandwars/formatting'
import { mostSimilarHeroes } from '@/wandwars/prediction/nn'
import { NN_WEIGHTS } from '@/wandwars/prediction/nnWeights'
import { computeCompositionStats, localizeCompositionLabel } from './composition'
import type { Insight, InsightDeps } from './types'

export function buildUnits(deps: InsightDeps): Insight[] {
  const result: Insight[] = []
  const { t, matchData, analysisData, teamRecords, heroAttrMap } = deps
  const totalMatches = matchData.length
  const allHeroes = Object.values(analysisData.heroStats)
  const counterMatrix = analysisData.counterMatrix
  const pairMin = metaMinPairMatches(totalMatches)

  const ti = (key: string, vars?: Record<string, string | number>) =>
    t(`wandwars.insights/${key}`, vars)
  const add = (text: string) => result.push({ text, category: 'units' })

  // --- Hero usage / win-rate ranking ---

  const sortedByMatches = [...allHeroes].sort((a, b) => b.matches - a.matches)
  const topHero = sortedByMatches[0]
  if (topHero && topHero.matches >= 10) {
    add(
      ti('most-picked', {
        hero: `{${topHero.name}}`,
        matches: topHero.matches,
        winRate: formatPercent(topHero.winRate),
      }),
    )
  }

  const reliableHeroes = [...allHeroes].filter((s) => s.matches >= 5)
  const bestHero = [...reliableHeroes].sort((a, b) => b.winRate - a.winRate)[0]
  if (bestHero && bestHero.name !== topHero?.name) {
    add(
      ti('highest-winrate', {
        hero: `{${bestHero.name}}`,
        winRate: formatPercent(bestHero.winRate),
        matches: bestHero.matches,
      }),
    )
  }

  const sortedByWinRate = [...reliableHeroes].sort((a, b) => a.winRate - b.winRate)
  const worstHero = sortedByWinRate[0]
  if (worstHero && worstHero.winRate < 0.45) {
    add(
      ti('lowest-winrate', {
        hero: `{${worstHero.name}}`,
        winRate: formatPercent(worstHero.winRate),
        matches: worstHero.matches,
      }),
    )
  }

  const heroTeamCounts: Record<string, number> = {}
  for (const team of teamRecords) {
    for (const hero of team.team) {
      heroTeamCounts[hero] = (heroTeamCounts[hero] || 0) + 1
    }
  }
  const mostVersatile = Object.entries(heroTeamCounts).sort(([, a], [, b]) => b - a)[0]
  if (mostVersatile && mostVersatile[1] >= 5) {
    add(ti('most-versatile', { hero: `{${mostVersatile[0]}}`, count: mostVersatile[1] }))
  }

  const avgMatches = allHeroes.reduce((sum, h) => sum + h.matches, 0) / allHeroes.length
  const hiddenGem = [...reliableHeroes]
    .filter((h) => h.matches < avgMatches * 0.7 && h.winRate > INSIGHT_NOTABLE_WINRATE)
    .sort((a, b) => b.winRate - a.winRate)[0]
  if (hiddenGem) {
    add(
      ti('hidden-gem', {
        hero: `{${hiddenGem.name}}`,
        winRate: formatPercent(hiddenGem.winRate),
        matches: hiddenGem.matches,
      }),
    )
  }

  const rivalrySeen = new Set<string>()
  let biggestRivalry: { a: string; b: string; matches: number } | null = null
  for (const [hero, opponents] of Object.entries(counterMatrix)) {
    for (const [opp, entry] of Object.entries(opponents)) {
      const key = [hero, opp].sort().join(':')
      if (rivalrySeen.has(key)) continue
      rivalrySeen.add(key)
      if (!biggestRivalry || entry.matches > biggestRivalry.matches) {
        const [a, b] = [hero, opp].sort()
        biggestRivalry = { a: a!, b: b!, matches: entry.matches }
      }
    }
  }
  if (biggestRivalry && biggestRivalry.matches >= pairMin) {
    add(
      ti('biggest-rivals', {
        heroA: `{${biggestRivalry.a}}`,
        heroB: `{${biggestRivalry.b}}`,
        matches: biggestRivalry.matches,
      }),
    )
  }

  const mostBalanced = [...reliableHeroes]
    .filter((h) => h.matches >= 8)
    .sort((a, b) => Math.abs(a.winRate - 0.5) - Math.abs(b.winRate - 0.5))[0]
  if (mostBalanced && Math.abs(mostBalanced.winRate - 0.5) < INSIGHT_BALANCED_TOLERANCE) {
    add(
      ti('most-balanced', {
        hero: `{${mostBalanced.name}}`,
        winRate: formatPercent(mostBalanced.winRate),
        matches: mostBalanced.matches,
      }),
    )
  }

  const leastPicked = sortedByMatches[sortedByMatches.length - 1]
  if (leastPicked && leastPicked.matches >= 1 && leastPicked.name !== worstHero?.name) {
    add(ti('least-picked', { hero: `{${leastPicked.name}}`, matches: leastPicked.matches }))
  }

  const secondBest = [...reliableHeroes].sort((a, b) => b.winRate - a.winRate)[1]
  if (
    secondBest &&
    secondBest.name !== topHero?.name &&
    secondBest.winRate > INSIGHT_NOTABLE_WINRATE
  ) {
    add(
      ti('second-highest-winrate', {
        hero: `{${secondBest.name}}`,
        winRate: formatPercent(secondBest.winRate),
        matches: secondBest.matches,
      }),
    )
  }

  const mostWins = [...allHeroes].sort((a, b) => b.wins - a.wins)[0]
  if (
    mostWins &&
    mostWins.wins >= 5 &&
    mostWins.name !== bestHero?.name &&
    mostWins.name !== topHero?.name
  ) {
    add(
      ti('most-wins', {
        hero: `{${mostWins.name}}`,
        wins: mostWins.wins,
        matches: mostWins.matches,
      }),
    )
  }

  const mostLosses = [...allHeroes].sort((a, b) => b.losses - a.losses)[0]
  if (mostLosses && mostLosses.losses >= 5 && mostLosses.name !== worstHero?.name) {
    add(
      ti('most-losses', {
        hero: `{${mostLosses.name}}`,
        losses: mostLosses.losses,
        matches: mostLosses.matches,
      }),
    )
  }

  const firstPickCounts: Record<string, number> = {}
  for (const match of matchData) {
    const fp0 = match.left[0]
    const fp1 = match.right[0]
    if (fp0) firstPickCounts[fp0] = (firstPickCounts[fp0] || 0) + 1
    if (fp1) firstPickCounts[fp1] = (firstPickCounts[fp1] || 0) + 1
  }
  const topFirstPick = Object.entries(firstPickCounts).sort(([, a], [, b]) => b - a)[0]
  if (topFirstPick && topFirstPick[1] >= 3) {
    add(ti('most-popular-first-pick', { hero: `{${topFirstPick[0]}}`, count: topFirstPick[1] }))
  }

  const mostDraws = [...allHeroes].filter((h) => h.draws > 0).sort((a, b) => b.draws - a.draws)[0]
  if (mostDraws && mostDraws.draws >= 2) {
    add(ti('most-draws', { hero: `{${mostDraws.name}}`, count: mostDraws.draws }))
  }

  const counterVictims: Record<string, number> = {}
  for (const [, opponents] of Object.entries(counterMatrix)) {
    for (const [opp, entry] of Object.entries(opponents)) {
      if (entry.matches >= pairMin && entry.score > 0.1) {
        counterVictims[opp] = (counterVictims[opp] || 0) + 1
      }
    }
  }
  const mostCountered = Object.entries(counterVictims).sort(([, a], [, b]) => b - a)[0]
  if (mostCountered && mostCountered[1] >= 2) {
    add(ti('most-countered', { hero: `{${mostCountered[0]}}`, count: mostCountered[1] }))
  }

  const counterPowers: Record<string, number> = {}
  for (const [hero, opponents] of Object.entries(counterMatrix)) {
    for (const [, entry] of Object.entries(opponents)) {
      if (entry.matches >= pairMin && entry.score > 0.1) {
        counterPowers[hero] = (counterPowers[hero] || 0) + 1
      }
    }
  }
  const bestCounter = Object.entries(counterPowers).sort(([, a], [, b]) => b - a)[0]
  if (bestCounter && bestCounter[1] >= 2) {
    add(ti('best-counter', { hero: `{${bestCounter[0]}}`, count: bestCounter[1] }))
  }

  // High win rate but low picks — under-explored
  const underrated = [...reliableHeroes]
    .filter((h) => h.matches >= 3 && h.matches <= avgMatches * 0.5 && h.winRate > 0.5)
    .sort((a, b) => b.winRate - a.winRate)
  if (underrated.length >= 2 && underrated[1]!.name !== hiddenGem?.name) {
    const h = underrated[1]!
    add(
      ti('underrated', {
        hero: `{${h.name}}`,
        winRate: formatPercent(h.winRate),
        matches: h.matches,
      }),
    )
  }

  // High picks but below-average win rate — over-picked
  const overrated = [...reliableHeroes]
    .filter((h) => h.matches > avgMatches * 1.3 && h.winRate < 0.48)
    .sort((a, b) => a.winRate - b.winRate)[0]
  if (overrated && overrated.name !== worstHero?.name) {
    add(
      ti('overrated', {
        hero: `{${overrated.name}}`,
        matches: overrated.matches,
        winRate: formatPercent(overrated.winRate),
      }),
    )
  }

  // --- Sweeps ---

  const heroSweeps: Record<string, number> = {}
  for (const match of matchData) {
    if (match.result === 'draw' || match.weight <= 1) continue
    const winner = match.result === 'left' ? match.left : match.right
    for (const hero of winner) {
      heroSweeps[hero] = (heroSweeps[hero] || 0) + 1
    }
  }
  const topSweepHero = Object.entries(heroSweeps).sort(([, a], [, b]) => b - a)[0]
  if (topSweepHero && topSweepHero[1] >= 3) {
    add(ti('most-sweeps-hero', { hero: `{${topSweepHero[0]}}`, count: topSweepHero[1] }))
  }

  // --- Composition (class concentration only; damage/range/energy go to teams) ---

  const compStats = computeCompositionStats(matchData, heroAttrMap)
  for (const [label, { w, l }] of Object.entries(compStats.class)) {
    const total = w + l
    if (total < 20) continue
    const rate = w / total
    if (Math.abs(rate - 0.5) < INSIGHT_NOTABLE_DEVIATION) continue
    const verb = rate > 0.5 ? ti('overperform') : ti('underperform')
    add(
      ti('composition-pattern', {
        label: localizeCompositionLabel(label, t),
        verb,
        rate: formatPercent(rate),
        count: total,
      }),
    )
  }

  // --- ML: similar heroes for the most-used heroes ---

  const topByUsage = [...allHeroes].sort((a, b) => b.matches - a.matches).slice(0, 5)
  for (const hero of topByUsage) {
    if (hero.matches < 10) continue
    const similar = mostSimilarHeroes(NN_WEIGHTS, hero.name, 2)
    if (similar.length >= 2 && similar[0]!.similarity > 0.7) {
      add(
        ti('similar-heroes', {
          hero: `{${hero.name}}`,
          similar1: `{${similar[0]!.hero}}`,
          similar2: `{${similar[1]!.hero}}`,
        }),
      )
      break // Only show one to avoid clutter
    }
  }

  return result
}
