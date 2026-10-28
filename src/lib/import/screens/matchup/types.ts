/* What a screenshot of the Supreme League's knockout matchup list reads: its
 * games' panels top to bottom, each two teams of five hero cards and an
 * artifact. */

import type { HeroReading } from '../../card/types'
import type { Rect } from '../../core/types'
import type { ArtifactReading } from '../match/types'

// The left team's box sits under a blue bar, the right team's under a red one.
export type BarColour = 'blue' | 'red'

export interface MatchupTeam {
  // The box's bar, in the screenshot's pixels; everything else in the box is
  // placed from it.
  bar: Rect
  // Left to right; null when the box's lower edge is out of view (under the
  // bottom bar, or past the shot's edge).
  cards: HeroReading[] | null
  artifact: ArtifactReading
}

export type MatchupPanel = Record<BarColour, MatchupTeam>

export interface MatchupReading {
  // Consecutive games, top to bottom.
  panels: MatchupPanel[]
}
