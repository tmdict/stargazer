/* Readings of a season summary shared by the guide index's report entry and
 * counter ladder. */

import type { PvpSeasonSummary, PvpTeam } from '@/lib/types/pvp'

/** The season's static report, hydrated to this path at build (scripts/guideReports.ts). */
export const pvpReportHref = (season: number): string => `/guide/pvp/s${season}/`

/** Ladder order: best rating first; games break ties so the order is total. */
export const ladderTeams = (summary: PvpSeasonSummary): PvpTeam[] =>
  [...summary.teams].sort((a, b) => b.rating - a.rating || b.games - a.games)

export const mostPlayedTeams = (summary: PvpSeasonSummary, count: number): PvpTeam[] =>
  [...summary.teams].sort((a, b) => b.games - a.games).slice(0, count)
