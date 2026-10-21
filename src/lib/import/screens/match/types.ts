/* What the match screens (a result screen, a formation panel, a paused replay
 * frame) read, the reading each of them extends, and the references they are
 * read against. Pure data, shared by the worker, the composable, and the plan
 * builder in lib/teams/teamImport. */

import type { Team } from '@/lib/types/team'
import type { FrameRef, HeroReading, HeroTable } from '../../card/types'
import type { RgbaImage } from '../../core/types'

export interface ArtifactReading {
  // The icon with its frame, for the review.
  card: RgbaImage
  // Best first; empty for a header with no badge (no artifact, sure) or with
  // the icon's place outside the shot (not sure).
  candidates: { artifactId: number; score: number }[]
  margin: number
  // A clear lead, a good shape match, and art in the crop; or no badge at all.
  sure: boolean
}

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

export interface ArtifactTable {
  // One row per artifact: its id, the central art's shape vector and its
  // colour histogram.
  ids: number[]
  vectors: Float32Array[]
  colours: Float32Array[]
}

export interface ReferenceSet {
  frames: FrameRef[]
  heroes: HeroTable
  artifacts: ArtifactTable
  // Companions and phantimals with art of their own, by unit id, kept apart
  // from the heroes so a result card never ranks against them.
  units: HeroTable
}
