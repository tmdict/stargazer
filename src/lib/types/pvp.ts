/* A season's PvP summary: what the guide index shows for that season's
 * report, its title and its team groups. Generated with the season's report
 * and copied here beside its template, again with each export while the
 * season is played: a copy of the report's figures, not something the app
 * derives. */

import type { AppLocale } from './i18n'

export interface PvpTeam {
  /** The report's short label in each language of its summary, as the report itself reads. */
  name: { en: string } & Partial<Record<AppLocale, string>>
  /** Core hero slugs, in the order the name lists them, a core hero it leaves out last. */
  heroes: readonly string[]
  /** Recorded appearances; orders the most-played chips. */
  games: number
}

export interface PvpSeasonSummary {
  season: number
  /** True while the season is played: the guide marks it as the current season. */
  live?: boolean
  /** The Supreme League event the report's title names while the season is
   * played, which the guide's title for the report names too ("Season 8
   * Supreme League 1 report"). Without it the title reads "PvP report". */
  league?: number
  /** The languages the report is written in, English first. A site language
   * outside them reads the English report and names teams by their heroes. */
  languages: readonly AppLocale[]
  teams: readonly PvpTeam[]
}
