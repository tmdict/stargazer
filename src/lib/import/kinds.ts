/* The kinds of screenshot the import reads, what reading one gives, and the
 * parts of the references each kind waits for: a roster card needs only the
 * hero part (frames, portraits, learned faces), the match screens and the
 * matchup list the match part as well (artifacts, phantimals, the arena). */

import type { ScreenshotReading, ShotKind } from './screens/match/types'
import type { MatchupReading } from './screens/matchup/types'
import type { RosterReading } from './screens/roster/types'

export type ImportKind = ShotKind | 'roster' | 'matchup'

export type ImportReading = ScreenshotReading | RosterReading | MatchupReading

export type ReferencePart = 'heroes' | 'match'

export const partsOf = (kind: ImportKind): readonly ReferencePart[] =>
  kind === 'roster' ? ['heroes'] : ['heroes', 'match']

export const isRosterReading = (reading: ImportReading): reading is RosterReading =>
  'slots' in reading

export const isMatchupReading = (reading: ImportReading): reading is MatchupReading =>
  'panels' in reading
