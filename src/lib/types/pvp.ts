/* A finished season's PvP summary: the team groups and counter relationships
 * the guide index shows for that season. Written once when the season's
 * report lands and never edited: it is a locked snapshot of the report, not
 * something the app derives. Team ids double as the report's anchor slugs. */

/** The report's evidence class: 0 possible, 1 under 65% wins, 2 65 to 79%, 3 80% or more. */
export type CounterBand = 0 | 1 | 2 | 3

export interface PvpTeam {
  /** Referenced by counters; matches the report's anchor slug. */
  id: string
  /** The report's short label, shown as is in every locale. */
  name: string
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
  teams: readonly PvpTeam[]
  counters: readonly PvpCounter[]
}
