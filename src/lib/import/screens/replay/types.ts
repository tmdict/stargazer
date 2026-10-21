/* What a paused replay frame reads, and the arena it is placed against. */

import type { ScreenshotReading } from '../match/types'

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
