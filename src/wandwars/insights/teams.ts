import {
  INSIGHT_BALANCED_TOLERANCE,
  INSIGHT_NOTABLE_DEVIATION,
  metaMinTeamMatches,
} from '@/wandwars/constants'
import { formatPercent } from '@/wandwars/formatting'
import { nnForward } from '@/wandwars/prediction/nn'
import { NN_WEIGHTS } from '@/wandwars/prediction/nnWeights'
import { computeCompositionStats } from './composition'
import type { Insight, InsightDeps } from './types'

export function buildTeams(deps: InsightDeps): Insight[] {
  const result: Insight[] = []
  const { t, matchData, teamRecords, topSweepTeam, heroAttrMap } = deps
  const totalMatches = matchData.length
  const teamMin = metaMinTeamMatches(totalMatches)

  const ti = (key: string, vars?: Record<string, string | number>) =>
    t(`wandwars.insights/${key}`, vars)
  const add = (text: string) => result.push({ text, category: 'teams' })

  // --- Top-winning teams (hero frequency in top performers) ---

  const topWinningTeams = teamRecords
    .filter((tm) => tm.total >= teamMin && tm.wins > tm.losses)
    .sort((a, b) => b.winRate - a.winRate || b.total - a.total)
    .slice(0, 5)

  if (topWinningTeams.length >= 3) {
    const heroCounts: Record<string, number> = {}
    for (const team of topWinningTeams) {
      for (const hero of team.team) {
        heroCounts[hero] = (heroCounts[hero] || 0) + 1
      }
    }
    const frequent = Object.entries(heroCounts)
      .filter(([, count]) => count >= 2)
      .sort(([, a], [, b]) => b - a)
    for (const [hero, count] of frequent) {
      add(ti('appears-in-top-teams', { hero: `{${hero}}`, count, total: topWinningTeams.length }))
    }
  }

  // --- Team records ---

  // 3-0 happens 12.5% of the time at 50/50; 5-0 drops to 3.1% — at that point
  // "undefeated" actually means something.
  const perfectTeamMin = Math.max(5, teamMin)

  for (const team of teamRecords) {
    if (team.total >= perfectTeamMin && team.losses === 0) {
      add(
        ti('team-undefeated', {
          t0: `{${team.team[0]}}`,
          t1: `{${team.team[1]}}`,
          t2: `{${team.team[2]}}`,
          matches: team.total,
        }),
      )
    }
  }

  for (const team of teamRecords) {
    if (team.total >= perfectTeamMin && team.wins === 0) {
      add(
        ti('team-winless', {
          t0: `{${team.team[0]}}`,
          t1: `{${team.team[1]}}`,
          t2: `{${team.team[2]}}`,
          matches: team.total,
        }),
      )
    }
  }

  const mostPlayed = [...teamRecords].sort((a, b) => b.total - a.total)[0]
  if (mostPlayed && mostPlayed.total >= teamMin) {
    add(
      ti('team-most-played', {
        t0: `{${mostPlayed.team[0]}}`,
        t1: `{${mostPlayed.team[1]}}`,
        t2: `{${mostPlayed.team[2]}}`,
        matches: mostPlayed.total,
        winRate: formatPercent(mostPlayed.winRate),
      }),
    )
  }

  const bestTeam = [...teamRecords]
    .filter((tm) => tm.total >= teamMin)
    .sort((a, b) => b.winRate - a.winRate)[0]
  if (bestTeam && bestTeam.total >= teamMin) {
    const key = bestTeam.team.join(',')
    const mpKey = mostPlayed?.team.join(',')
    if (key !== mpKey) {
      add(
        ti('team-best-winrate', {
          t0: `{${bestTeam.team[0]}}`,
          t1: `{${bestTeam.team[1]}}`,
          t2: `{${bestTeam.team[2]}}`,
          winRate: formatPercent(bestTeam.winRate),
          wins: bestTeam.wins,
          losses: bestTeam.losses,
        }),
      )
    }
  }

  const worstTeam = [...teamRecords]
    .filter((tm) => tm.total >= teamMin)
    .sort((a, b) => a.winRate - b.winRate)[0]
  if (worstTeam && worstTeam.total >= teamMin && worstTeam.winRate < 0.4) {
    add(
      ti('team-worst-winrate', {
        t0: `{${worstTeam.team[0]}}`,
        t1: `{${worstTeam.team[1]}}`,
        t2: `{${worstTeam.team[2]}}`,
        winRate: formatPercent(worstTeam.winRate),
        wins: worstTeam.wins,
        losses: worstTeam.losses,
      }),
    )
  }

  for (const team of teamRecords) {
    if (team.total >= teamMin && team.draws === team.total) {
      add(
        ti('team-all-draws', {
          t0: `{${team.team[0]}}`,
          t1: `{${team.team[1]}}`,
          t2: `{${team.team[2]}}`,
          matches: team.total,
        }),
      )
    }
  }

  if (teamRecords.length >= 5) {
    add(ti('unique-teams', { count: teamRecords.length, matches: totalMatches }))
  }

  // Close records — at least 4 matches so 2W/2L is meaningful, plus the team-min for scale.
  for (const team of teamRecords) {
    if (
      team.total >= Math.max(4, teamMin) &&
      Math.abs(team.wins - team.losses) <= 1 &&
      team.wins >= 2
    ) {
      add(
        ti('team-even-record', {
          t0: `{${team.team[0]}}`,
          t1: `{${team.team[1]}}`,
          t2: `{${team.team[2]}}`,
          wins: team.wins,
          losses: team.losses,
          matches: team.total,
        }),
      )
      break
    }
  }

  const losingTeamHeroCounts: Record<string, number> = {}
  for (const team of teamRecords) {
    if (team.total >= teamMin && team.winRate < 0.4) {
      for (const hero of team.team) {
        losingTeamHeroCounts[hero] = (losingTeamHeroCounts[hero] || 0) + 1
      }
    }
  }
  const mostInLosingTeams = Object.entries(losingTeamHeroCounts).sort(([, a], [, b]) => b - a)[0]
  if (mostInLosingTeams && mostInLosingTeams[1] >= 2) {
    add(ti('in-losing-teams', { hero: `{${mostInLosingTeams[0]}}`, count: mostInLosingTeams[1] }))
  }

  const drawCount = matchData.filter((m) => m.result === 'draw').length
  if (drawCount > 0) {
    const drawRate = drawCount / matchData.length
    add(
      ti('draw-count', {
        count: drawCount,
        matches: matchData.length,
        rate: formatPercent(drawRate),
      }),
    )
  }

  if (topSweepTeam && topSweepTeam.sweeps >= 2) {
    const tm = topSweepTeam.team
    add(
      ti('team-most-dominant', {
        t0: `{${tm[0]}}`,
        t1: `{${tm[1]}}`,
        t2: `{${tm[2]}}`,
        sweeps: topSweepTeam.sweeps,
        total: topSweepTeam.total,
      }),
    )
  }

  const totalSweeps = matchData.filter((m) => m.weight > 1 && m.result !== 'draw').length
  if (totalSweeps >= 3) {
    const sweepRate = totalSweeps / matchData.filter((m) => m.result !== 'draw').length
    add(ti('sweep-count', { count: totalSweeps, rate: formatPercent(sweepRate) }))
  }

  // First-pick side advantage
  const leftWins = matchData.filter((m) => m.result === 'left').length
  const rightWins = matchData.filter((m) => m.result === 'right').length
  const decisiveCount = leftWins + rightWins
  if (decisiveCount >= 10) {
    const leftRate = leftWins / decisiveCount
    if (Math.abs(leftRate - 0.5) > INSIGHT_BALANCED_TOLERANCE) {
      const favored = leftRate > 0.5 ? ti('left-first-pick') : t('wandwars.right')
      const rate = leftRate > 0.5 ? leftRate : 1 - leftRate
      add(ti('side-advantage', { side: favored, rate: formatPercent(rate), leftWins, rightWins }))
    }
  }

  // --- Composition (damage / range / energy patterns; class is in units) ---

  const compStats = computeCompositionStats(matchData, heroAttrMap)
  for (const category of ['damage', 'range', 'energy'] as const) {
    for (const [label, { w, l }] of Object.entries(compStats[category])) {
      const total = w + l
      if (total < 20) continue
      const rate = w / total
      if (Math.abs(rate - 0.5) < INSIGHT_NOTABLE_DEVIATION) continue
      const verb = rate > 0.5 ? ti('overperform') : ti('underperform')
      add(ti('composition-pattern', { label, verb, rate: formatPercent(rate), count: total }))
    }
  }

  // --- ML: NN-predicted strongest trios (top 3) ---
  // Use a fixed "average opponent" trio for fast ranking — one forward pass per trio
  // instead of evaluating every possible matchup.
  const nnHeroes = Object.keys(NN_WEIGHTS.heroIndex)
  const avgOppStep = Math.max(1, Math.floor(nnHeroes.length / 3))
  const avgOpp = [0, avgOppStep, avgOppStep * 2]
  const nnTopTeams: { team: [string, string, string]; score: number }[] = []
  for (let i = 0; i < nnHeroes.length; i++) {
    for (let j = i + 1; j < nnHeroes.length; j++) {
      for (let k = j + 1; k < nnHeroes.length; k++) {
        const teamIdx = [i, j, k]
        if (avgOpp.some((x) => teamIdx.includes(x))) continue
        const score = nnForward(NN_WEIGHTS, teamIdx, avgOpp)
        nnTopTeams.push({ team: [nnHeroes[i]!, nnHeroes[j]!, nnHeroes[k]!], score })
      }
    }
  }
  nnTopTeams.sort((a, b) => b.score - a.score)
  for (const tm of nnTopTeams.slice(0, 3)) {
    add(
      ti('predicted-top-team', {
        t0: `{${tm.team[0]}}`,
        t1: `{${tm.team[1]}}`,
        t2: `{${tm.team[2]}}`,
      }),
    )
  }

  return result
}
