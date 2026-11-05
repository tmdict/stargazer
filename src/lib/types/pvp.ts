/* A season's PvP summary: what the guide index shows for that season's
 * report, its title and its team groups. Generated with the season's report
 * and kept beside its template in the data pack, renewed with each export
 * while the season is played: a copy of the report's figures, not something the
 * app derives. */

import type { AppLocale } from './i18n'

export interface PvpTeam {
  /** The report's short label in each language of its summary, as the report itself reads. */
  name: { en: string } & Partial<Record<AppLocale, string>>
  /** Core hero slugs, in portrait order. */
  heroes: readonly string[]
  /** Recorded appearances; orders the most-played chips. */
  games: number
}

export interface PvpSeasonSummary {
  season: number
  /** True while the season is played: the guide marks it as the current season. */
  live?: boolean
  /** True while the report's title names Supreme League, a temporary title
   * the season's report can take while it is played. */
  league?: boolean
  /** The languages the report is written in, English first. A site language
   * outside them reads the English report and names teams by their heroes. */
  languages: readonly AppLocale[]
  teams: readonly PvpTeam[]
}
