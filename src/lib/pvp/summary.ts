/* Readings of a season summary shared by the guide index's report entry and
 * counter ladder. */

import type { AppLocale } from '@/lib/types/i18n'
import type { PvpSeasonSummary, PvpTeam } from '@/lib/types/pvp'

/** The season's static report, hydrated to this path at build (scripts/guideReports.ts).
 * It sits outside the locale-prefixed routes and opens in English unless the
 * link asks for Chinese with `?lang=zh`; a fragment goes after the query. */
export const pvpReportHref = (season: number, lang: AppLocale): string =>
  `/guide/pvp/s${season}/${lang === 'zh' ? '?lang=zh' : ''}`

/** Ladder order: best rating first; games break ties so the order is total. */
export const ladderTeams = (summary: PvpSeasonSummary): PvpTeam[] =>
  [...summary.teams].sort((a, b) => b.rating - a.rating || b.games - a.games)

export const mostPlayedTeams = (summary: PvpSeasonSummary, count: number): PvpTeam[] =>
  [...summary.teams].sort((a, b) => b.games - a.games).slice(0, count)
