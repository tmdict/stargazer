/* What a formation shot reads: where the board lies and the units standing
 * on it, besides the card row a match screen reads. */

import type { Team } from '@/lib/types/team'
import type { HeroCandidate } from '../../card/types'
import type { RgbaImage } from '../../core/types'
import type { ScreenshotReading } from '../match/types'

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
