/* Geometry and thresholds of the Resonating Hall screenshot, measured on the
 * labelled roster screenshots. */

import { CARD_ASPECT, READ_WIDTH } from '../../card/frames'
import { starRowTop, type StarRow } from '../../card/stars'

// The cream ground: about (235, 230, 220) on every set, saturation 0.05 to 0.08,
// value 0.91 to 0.93. Grey (the empty slot's placeholder) counts as ground too;
// pure white (the filter button) does not.
export const CREAM = { vMin: 0.8, vMax: 0.985, greyS: 0.04, s: 0.13, h: [20, 65] } as const
// The grid is found on a copy at most this wide.
export const WORK_MAX = 1000
// A roster shot is read at its own size up to this width: the grid is found on a
// copy WORK_MAX wide and each card is read rescaled, so a wider capture only costs
// decoding.
export const ROSTER_MAX_WIDTH = 2560
// The star row of a card read at READ_WIDTH, larger than a result card's: on the
// labelled roster shots a refined row's stars are 9.8 to 10 px apart, centred
// from 0.1 px right to 0.6 px left of the box's middle, and a seven-row band
// centred on them starts 34.9 to 38.3 px above the box's centre.
export const CARD_STARS: StarRow = { above: 37, pitch: 9.85, left: 0.25 }
// The star row's top as a share of a template box's height: the highest pixel row the
// star reader looks at on the copy the cards are read from.
export const STAR_ROW =
  starRowTop({ x: 0, y: 0, w: READ_WIDTH, h: READ_WIDTH * CARD_ASPECT }, CARD_STARS) /
  (READ_WIDTH * CARD_ASPECT)
export const COLUMNS = 6
// The Hands of Resonance row holds five cards.
export const HANDS = 5
export const HANDS_GAP = 0.1
// A row of cards is this share of the expected card height; less, and it is cut.
export const WHOLE_ROW = [0.85, 1.18] as const
// A card's side edges, as shares of its width from each side: the frame's border,
// or a borderless card's plate, is never ground there.
export const EDGE = [0.03, 0.11] as const
// Closed gutters over this share of a card's height are an overlay (the bottom bar
// closes them for about 0.8 of a card), not the frames' side bulges (up to 0.15
// where the gutter is narrowest).
export const COVER_RUN = 0.35
// A row on the grid's columns has its inner gutters open over at least this share
// (0.67 to 1 on rows of cards, the narrowest gutters lowest), and the margin left of
// its first column open over at least MARGIN_OPEN: the bottom bar, whose light pills
// leave some inner gutters open (0.59), spans the margin too.
export const GUTTER_OPEN = 0.5
export const MARGIN_OPEN = 0.6
// A pixel row is closed when at most this many of the five inner gutters are ground.
// The bottom bar's light pills can leave more open; the row's share of open gutters
// (GUTTER_OPEN) tells it from cards.
export const CLOSED_OPEN = 1
// The column pitch searched, as a share of the shot's width: a capture of a
// whole desktop puts six columns in a twentieth of it, a crop of the grid in all.
export const PITCH_SHARE = [1 / 30, 1 / 5.4] as const
// The shot is cut into about this many slabs, overlapping by half, to find the grid.
export const SLABS = 16
// The grid on the work copy of labelled screenshots: ground covers 0.21 to 0.75 of the
// shot, the comb's cards fill 0.86 to 0.96 of its pitch, and the comb scores 0.52 to
// 0.83. On match screens ground covers 0.17 at most (0.02 on result screens) and the
// best combs score 0.32; on a flat profile a comb's gutters can run the whole pitch,
// leaving no card to size the rows by. With less ground than `ground`, no comb is fitted.
export const GRID = { ground: 0.1, card: 0.75, score: 0.4 } as const
// The scroll's top edge sits under the grid's header and its title, a band of 0.07 to
// 0.12 of a card on labelled screenshots, so a first row that runs up under it loses
// its frames' tops though its sides look whole. Going up from the row, the edge is the
// first pixel row where less than `shows` of the six cards' width is not ground (the
// header leaves 0.016 or less). The row is under the edge when that lies less than
// `edge` of a card below the title (0.071 to 0.094 on labelled rows under it, 0.108 or
// more on whole rows, whose crests start there), and its cards fade in from the
// header's cream over about `fade` of a template box's height.
export const HEADER = { length: [0.05, 0.2], shows: 0.02, edge: 0.1, fade: 0.056 } as const
// The faction filter button floats over the last rows' right columns as a white
// pill. Near-white fills at most 0.08 of a card's box on labelled screenshots, and
// 0.16 of the one the button covers, too much hidden to read.
export const COVERED = 0.12

// The frame templates' opaque part is 261 of their 280 px (all but the winged P4),
// so a template box is wider than the card it matches.
export const OPAQUE_SHARE = 261 / 280
