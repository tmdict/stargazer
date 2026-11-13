/* Geometry and thresholds of a formation screenshot, in hex radii of the fitted
 * board unless a constant says otherwise, measured on the labelled formation
 * captures. */

import { FACE_ASPECT } from '../../card/heroes'
import type { StarRow } from '../../card/stars'

// ---------- the board fit ----------

// A portrait stands on its tile with its pointer's tip at the tile centre, so
// its ring sits RING_RISE hex radii above that centre on every row, and is
// RING_RADIUS across. Measured on 128 units over four capture sets: rise 0.75
// to 0.91, radius 0.63.
export const RING_RISE = 0.83
export const RING_RADIUS = 0.63

// How far to either side of the outline, along the edge normal, the samples
// that must read darker than the line sit, in hex radii.
export const OFF_LINE = 0.3

// How far each pixel's luminance stands above the brighter of its two
// neighbours LINE_REACH pixels away, best over four directions: high on a thin
// light line, low on flat areas and broad light regions.
export const LINE_REACH = 3

// A sample counts as found on a line this much above its surroundings.
export const LINE_FLOOR = 20

// The fit runs on a copy this wide (or the shot itself when narrower), pooled
// by POOL for the coarse pass. Boards from MIN_WIDTH of the copy's width up to
// all of it are tried, in SCALE_STEP increments.
export const FIT_WIDTH = 480
export const POOL = 4
export const MIN_WIDTH = 0.35
export const SCALE_STEP = 0.015

// Refinement windows on the copy, widest first: scale (px per hex radius)
// and centre shift ranges with their steps.
export const REFINE = [
  { scale: 1.5, scaleStep: 0.25, shift: 6, shiftStep: 1 },
  { scale: 0.3, scaleStep: 0.05, shift: 1, shiftStep: 0.25 },
] as const

// Below this share of the outline on a line there is no board: measured 0.47
// to 0.73 on formation captures (portraits standing on the far rows hide part
// of it), and at most 0.25 on result screens, where the best fit is chance.
export const SUPPORT_FLOOR = 0.4

// ---------- the units, strip and cards ----------

// A formation shot is read at its own size, which the board fit measures, up
// to a width that keeps a full-resolution phone capture quick to read.
export const FORMATION_MAX_WIDTH = 1200

// Each tile's ring is searched this far either side of its nominal centre.
export const RING_REACH = 0.3
export const RING_STEP = 0.04
export const RING_SAMPLES = 48

// The ring is light and grey, brighter than the portrait inside it and the
// board outside. A tile holds a unit when this share of its circle reads so:
// 0.54 to 0.98 on units (a nearer portrait can cover part of a far one's ring),
// at most 0.29 on empty tiles.
export const RING_FLOOR = 0.4
export const RING_LIGHT = 180
export const RING_CONTRAST = 12
export const RING_GREY = 45

// Face crops of a portrait in ring radii (width, and top relative to the ring's
// centre), in the hero table's landscape shape. The first ranks the whole
// table; the others suit heroes framed wider or higher and re-score the leaders.
// Each takes FACE_MARGIN times the face's framing about its centre, which puts
// a board face mid-way in the table's window grid rather than at its edge.
const FACE_MARGIN = 1.3
export const FACE_BOXES = [
  { w: 1.0, top: -0.45 },
  { w: 1.2, top: -0.5 },
  { w: 1.1, top: -0.6 },
  { w: 1.2, top: -0.62 },
].map(({ w, top }) => ({
  w: w * FACE_MARGIN,
  top: top - (FACE_ASPECT / 2) * w * (FACE_MARGIN - 1),
}))

// Enough candidates that a lineup read elsewhere still finds its hero among them.
export const UNIT_CANDIDATES = 60
export const UNIT_CARD = 64

// A tile with under this share of its samples left uncovered by portraits is
// unclear.
export const TILE_MIN_SHARE = 0.25

// Lit tiles read about 135 and over, the others 115 and under. The split goes
// in the widest gap between the board's own tile readings, when it is this wide.
export const LIT_GAP = 12

// The numbered circles under the board, measured on four capture sets: their
// centres STRIP.below hex radii below the board's centre, STRIP.pitch apart
// about STRIP.centre, the selected one ringed in green of radius STRIP.ring.
// A circle is there when its numeral is: white pixels fill 0.24 to 0.41 of
// its inner disc, and none where a strip has no circle.
export const STRIP = { below: 5.73, pitch: 1.87, centre: -0.05, ring: 0.71, band: 0.55 } as const
export const STRIP_POSITIONS = [-2, -1, 0, 1, 2] as const
export const NUMERAL_DISC = 0.3
export const NUMERAL_FLOOR = 0.1

// The hero cards sit in a row under the strip, their tops CARD_TOP hex radii
// below the board's centre and CARD_PITCH apart. The row starts at one of two
// places, as the phantimal slot before the artifact card is there or not:
// measured on four capture sets, 2.45 to 2.51 hex radii left of the board's
// centre with it and 3.38 to 3.44 without. Each start is searched CARD_SLACK
// either way and the stronger frame comb wins, since the other start puts
// every card half a card off its frame. Read on a copy where the board is
// CARD_SCALE px per hex radius, the scale at which the cards meet the frame
// templates.
export const CARD_SCALE = 46.2
export const CARD_TOP = 7.2
export const CARD_STARTS = [-2.49, -3.41] as const
export const CARD_SLACK = 0.2
export const CARD_PITCH = 1.58
export const CARD_PITCH_SLACK = 2
export const CARD_COUNT = 5

// The comb mean a row must reach to be read at all.
export const ROW_FLOOR = 0.27

// The star row of a card read at CARD_SCALE, larger than a result card's: on
// the twenty formation shots a full row's stars are 10.4 to 10.5 px apart,
// centred from 0.1 px right to 0.3 px left of the box's middle, and a seven-row
// band centred on them starts 39 to 40.2 px above the box's centre.
export const CARD_STARS: StarRow = { above: 39, pitch: 10.5, left: 0.2 }

// The artifact card before the row: its art disc's centre from the first
// card's top-left and its diameter, in hex radii. Placed so on four capture
// sets, where it reads all ten labelled artifacts.
export const ARTIFACT = { dx: -1.25, dy: 0.85, diameter: 0.78 } as const
