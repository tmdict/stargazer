/* Geometry of the matchup list, in bar widths from a team bar's top-left. Every
 * team box has one shape, so its bar (bars.ts) places everything else in it.
 * Measured on six sample sets: two phones' captures in English and Italian, PNG
 * and JPEG, and two stitched shots. */

import type { StarRow } from '../../card/stars'

// A matchup shot is read at its own size up to this width: each card is read
// rescaled, so a wider capture only costs decoding. The narrowest sample is 1178
// px wide; at the least, a card is about 80 px wide.
export const MATCHUP_MAX_WIDTH = 2560
export const MATCHUP_MIN_WIDTH = 900

// The five cards' frame template boxes: `w` wide, `pitch` apart from `x` in, `y`
// below the bar's top.
export const CARDS = { x: 0.004, pitch: 0.1903, y: 0.145, w: 0.2 } as const

// The artifact's art disc: its centre `dx` in from the bar's outer end (the left
// end of a blue bar, the right end of a red one) and `dy` below its top, and its
// diameter.
export const DISC = { dx: 0.122, dy: 0.06, diameter: 0.077 } as const

// The star row of a card read at the frame templates' middle width: on the
// samples' clear rows the band starts 35 to 38 px above the box's centre and the
// stars are 10 to 10.5 px apart.
export const CARD_STARS: StarRow = { above: 36, pitch: 10.25, left: 0.5 }

// The white strip along a box's foot, under its cards: on the samples 0.047 to
// 0.062 tall, starting 0.42 to 0.44 below the bar's top, and missing wherever the
// bottom bar or the shot's edge covers the cards. A row is the strip's when
// `white` of the bar's span is white, and the cards are in view when `least` of
// it shows between `from` and `to`.
export const FOOT = { from: 0.38, to: 0.56, white: 0.8, least: 0.025 } as const
