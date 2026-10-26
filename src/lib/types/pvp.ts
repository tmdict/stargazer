/* A season's PvP summary: the team groups and counter relationships the guide
 * index shows for that season. Generated with the season's report and copied
 * here beside its template, again with each export while the season is
 * played: a copy of the report's figures, not something the app derives. Team
 * ids double as the report's anchor slugs. */

import type { AppLocale } from './i18n'

/** The report's evidence class: 0 possible, 1 under 65% wins, 2 65 to 79%, 3 80% or more. */
export type CounterBand = 0 | 1 | 2 | 3

export interface PvpTeam {
  /** Referenced by counters; matches the report's anchor slug. */
  id: string
  /** The report's short label in each language of its summary, as the report itself reads. */
  name: { en: string } & Partial<Record<AppLocale, string>>
  /** Core hero slugs, in portrait order. */
  heroes: readonly string[]
  /** Recorded appearances; orders the most-played chips. */
  games: number
  /** Equal-upgrade strength rating; orders the ladder, best first. */
  rating: number
  /** Strength tier, 1 the best; groups the ladder rows. */
  tier: number
}

export interface PvpCounter {
  winner: string
  loser: string
  wins: number
  losses: number
  band: CounterBand
  /** Fragment id of the matchup's evidence section in the report. */
  anchor: string
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
  counters: readonly PvpCounter[]
}
