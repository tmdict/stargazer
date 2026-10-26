/* Readings of a season summary for the guide's PvP pages. */

import type { AppLocale } from '@/lib/types/i18n'
import type { PvpSeasonSummary, PvpTeam } from '@/lib/types/pvp'

export const reportReadsIn = (summary: PvpSeasonSummary, lang: AppLocale): boolean =>
  summary.languages.includes(lang)

/** The season's static report, hydrated to this path at build (scripts/guideReports.ts).
 * It sits outside the locale-prefixed routes and opens in English unless the
 * link asks for another language with `?lang=`. A report reads a language it
 * has no translation in as English, so the link asks for the site language
 * whatever the season offers; a fragment goes after the query. */
export const pvpReportHref = (season: number, lang: AppLocale): string =>
  `/guide/pvp/s${season}/${lang === 'en' ? '' : `?lang=${lang}`}`

export const mostPlayedTeams = (summary: PvpSeasonSummary, count: number): PvpTeam[] =>
  [...summary.teams].sort((a, b) => b.games - a.games).slice(0, count)
