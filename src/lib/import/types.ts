/* Match screenshot import: the readings a result or formation screenshot
 * yields, and the reference tables the readers match against. Pure data,
 * shared by the worker, the composable, and the plan builder in
 * lib/teams/teamImport. */

import type { Team } from '@/lib/types/team'
import type { FrameRef, HeroCandidate, HeroReading, HeroTable } from './card/types'
import type { RgbaImage } from './core/types'

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

// ---------- formation shots ----------

// Where a formation shot draws the board: screen pixels per hex radius, the
// board's centre (the middle hex), and the share of its outline found on a
// light line, which is the fit's evidence.
export interface BoardFit {
  scale: number
  x: number
  y: number
  support: number
}

// A unit standing on a formation board: its portrait's ring, the tile its
// pointer marks, and who it may be.
export interface UnitReading {
  hexId: number
  // In the shot's pixels.
  ring: { x: number; y: number; radius: number }
  // Share of the ring found: under 1 where a nearer portrait covers part of it.
  score: number
  // Best first: heroes by their base id, companions and phantimals by their
  // unit id.
  candidates: HeroCandidate[]
  // The portrait, cropped, for the review.
  card: RgbaImage
}

// What a formation shot says. It shows one team, so its card row is that
// side's cells and its artifact that side's; the slot strip under the board
// stands in for the result strip (mapIndex, mapCount), with no results.
export interface FormationReading extends ScreenshotReading {
  // The read image's size, the pixels the board fit and the rings are in.
  size: { width: number; height: number }
  board: BoardFit | null
  // The team the shot shows, from where its lit tiles lean; null without a board.
  side: Team | null
  // The lit tiles (the shown team's deployment tiles) by hex id, and the
  // tiles portraits cover too much to read.
  tiles: number[]
  unclear: number[]
  units: UnitReading[]
}

export const isFormationReading = (reading: ScreenshotReading): reading is FormationReading =>
  'units' in reading

// Where a replay frame sits against the reference frame its camera was
// measured in: reference pixel p is frame pixel (x, y) + scale * p, and score is
// how well the arena matched there.
export interface ReplayPlacement {
  scale: number
  x: number
  y: number
  score: number
}

// A paused replay frame: no cards, only where the board lies in it. The map
// strip's ring stands in for the result strip (mapIndex, mapCount), with no
// results; the sides and artifacts are empty.
export interface ReplayReading extends ScreenshotReading {
  // The read image's size, the pixels the placement is in.
  size: { width: number; height: number }
  placement: ReplayPlacement | null
}

export const isReplayReading = (reading: ScreenshotReading): reading is ReplayReading =>
  'placement' in reading

// ---------- references ----------

export interface ArtifactTable {
  // One row per artifact: its id, the central art's shape vector and its
  // colour histogram.
  ids: number[]
  vectors: Float32Array[]
  colours: Float32Array[]
}

export interface GreyImage {
  width: number
  height: number
  data: Float32Array
}

// The Supreme League arena for placing replay frames, at two reductions.
export interface ArenaRef {
  fine: GreyImage
  coarse: GreyImage
}

export interface ReferenceSet {
  frames: FrameRef[]
  heroes: HeroTable
  artifacts: ArtifactTable
  // Companions and phantimals with art of their own, by unit id, kept apart
  // from the heroes so a result card never ranks against them.
  units: HeroTable
}
