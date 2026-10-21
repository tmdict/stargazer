/* What a roster screenshot reads: where the grid and the Hands of Resonance lie,
 * every slot in them, and each whole card's reading. */

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

export interface RosterReading {
  grid: Grid | null
  slots: Slot[]
  // Each slot's reading, in slot order; null for a slot not read (empty or clipped).
  cells: (HeroReading | null)[]
  // The template width the grid's cards were read at, in the shot's pixels.
  width: number
}
