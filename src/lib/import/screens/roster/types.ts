/* What a roster screenshot reads: where the grid and the Hands of Resonance lie,
 * every slot in them, and each whole card's frame family and reading. */

import type { HeroReading } from '../../card/types'
import type { Rect } from '../../core/types'
import type { Comb } from './comb'

export type SlotKind = 'card' | 'clipped' | 'empty'

export interface Slot {
  // Grid rows top to bottom from 0; -1 for the Hands of Resonance.
  row: number
  col: number
  hands: boolean
  box: Rect
  kind: SlotKind
  // Share of the card's height in view.
  inView: number
}

export interface Grid {
  comb: Comb
  // The cards' size and the rows found, in the shot's pixels.
  w: number
  h: number
  rows: number
  // Bands that are neither a row nor the hands: header text, the Soul Pact row.
  other: number
}

// A paragon frame (S+, which the app calls P0, to P4), or a card below S+: a plate
// with no frame, or a lower tier's frame.
export type FrameFamily = 'paragon' | 'below'

export interface RosterSlot extends Slot {
  // A whole card's frame family and reading; null for a slot not read (empty or
  // clipped). A card below S+ reads as P0, R0.
  frame: { family: FrameFamily; sure: boolean } | null
  cell: HeroReading | null
}

export interface RosterReading {
  grid: Grid | null
  slots: RosterSlot[]
}
