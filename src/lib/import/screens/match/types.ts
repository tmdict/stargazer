/* What the match screens (a result screen, a formation panel, a paused replay
 * frame) read, the reading each of them extends, and the references they are
 * read against. Pure data, shared by the worker, the composable, and the plan
 * builder in lib/teams/teamImport. */

import type { Team } from '@/lib/types/team'
import type { ArtifactReading, ArtifactTable } from '../../artifact/types'
import type { FrameRef, HeroReading, HeroTable } from '../../card/types'

export type ImportWarning =
  | { kind: 'no-panel'; side: Team }
  | { kind: 'no-strip' }
  | { kind: 'unrecognised'; side: Team; row: number }
  // A formation shot without a whole board: nothing else is read from it.
  | { kind: 'no-board' }
  // A replay frame the arena could not be matched in: no board to draw.
  | { kind: 'no-arena' }

// A result screen, a formation panel, or a paused replay frame.
export type ShotKind = 'result' | 'formation' | 'replay'

// What one screenshot says, independent of the mode it is reviewed in: the
// strip is always read, and the board it fills is settled at review time.
export interface ScreenshotReading {
  // 0-based, from the green ring on the bottom strip; null when no strip.
  mapIndex: number | null
  // How many maps the match had, from the strip's circles; null when no strip.
  mapCount: number | null
  // The winner of this map, from the Ally tab colour.
  winner: Team | null
  // Per strip circle, who won, from the tick or cross; null where cropped off.
  mapResults: (Team | null)[]
  // Five rows each, top to bottom.
  sides: Record<Team, HeroReading[]>
  artifacts: Record<Team, ArtifactReading | null>
  warnings: ImportWarning[]
}

export interface ReferenceSet {
  frames: FrameRef[]
  heroes: HeroTable
  artifacts: ArtifactTable
  // The heroes as a formation board draws them (references.buildBoardTable),
  // which its portraits rank against instead of the result cards' `heroes`.
  board: HeroTable
  // Companions and phantimals, by unit id, kept apart from the heroes so a
  // result card never ranks against them.
  units: HeroTable
}
