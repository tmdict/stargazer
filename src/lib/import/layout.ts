/* Geometry of a result screenshot, in the pixels of the shot framed to
 * CANONICAL_WIDTH by its tabs (panel.ts). Nominal positions only seed the
 * searches (strip.ts finds the Ally and Enemy tabs, frames.ts settles each
 * card column under its tab, and every other region derives from those
 * anchors); the ratios are the game's layout and hold across the phone and
 * desktop captures measured. */

import { Team } from '@/lib/types/team'

export const CANONICAL_WIDTH = 1150

// A result shot is read at its own size up to this width, so a panel that
// fills only part of a large capture keeps its pixels until it is framed.
export const RESULT_MAX_WIDTH = 4096

// A region at a fixed offset from a landmark point.
export interface Region {
  dx: number
  dy: number
  w: number
  h: number
}

// The portrait column: card frames stacked at a fixed pitch in each panel.
// The pitch and the gap between the panels shift by a few percent between
// phone shapes, so both are settled per shot around these nominals.
export const CARD_COLUMN_X = 38
export const CARD_ROWS = 5
export const CARD_PITCH = 99.5
export const CARD_PITCH_RANGE = [95, 104] as const
// The ally column's first card in a crop; the enemy column starts a panel
// gap below it, further on a taller phone.
export const CARD_TOP = 237
export const PANEL_GAP = 710
export const PANEL_GAP_RANGE = [620, 900] as const

// The face inside a matched frame: fractions of the frame box. Only the upper
// part of the art is used, since the badges and the frame's white swirl
// cover the rest.
export const ART_BOX = { x: 0.23, y: 0.2, w: 0.69, aspect: 36 / 48 } as const

// The art disc of the round artifact icon under each player name: its
// nominal centre relative to the ally column anchor, and its diameter. The
// header's distance from the cards varies by a few pixels, which the
// artifact search absorbs.
export const HEADER_ICON: { dx: Record<Team, number>; dy: number; diameter: number } = {
  dx: { [Team.ALLY]: 179, [Team.ENEMY]: 874 },
  dy: -147,
  diameter: 34,
}

// The Ally and Enemy tabs as landmarks: each is a solid orange or blue block
// (that team's result on this map) at the panel's top left, beside the
// panel's dark header row, and its team's first card starts just under it.
// `left` and `width` are where the tab stands in this layout, which every
// shot is framed to (panel.ts). The search is in tab widths, since a shot's
// scale is unknown until its tabs are found: a tab is about half its width
// high, the header row past it is dark but for the sword icon, and the enemy
// tab stands a panel below the ally tab.
export const TABS = {
  left: 12,
  width: 146,
  // The narrowest tab looked for, in shot pixels: a panel about 400 wide.
  minWidth: 50,
  fill: 0.6,
  dark: { from: 0.2, to: 1.9, max: 0.25 },
  height: [0.3, 0.8],
  gap: [2.8, 7.8],
  toCard: 8,
} as const

// The Ally tab relative to the ally column anchor, for when the tabs were
// not found outright.
export const TAB_REGION: Region = { dx: -18, dy: -62, w: 100, h: 30 }

// The solid bar of the summary row under a panel's fifth card (orange for
// the ally panel, blue for the enemy), relative to the fifth card's top-left:
// what tells a real column from the same five rows started one row too high,
// at the tab, which matches a frame well. `solid` is the least fraction of
// the region in a result colour; a card row's thin stat bars fall well short.
export const SUMMARY_BAR: Region & { solid: number } = {
  dx: 150,
  dy: 110,
  w: 750,
  h: 40,
  solid: 0.5,
}

// The map strip: circles at a fixed pitch (a fraction of the width, the same
// for three and five circles) about centred on the image, below the enemy
// panel. The ring is searched within `band` pitches below the panel (a raw
// capture goes on below), `slack` pixels either side of each circle's
// nominal centre (a crop that is not quite centred), and at the nominal
// radius or a little under it (the circles are smaller on some phones).
export const STRIP = {
  pitch: 0.0887,
  centre: 0.49,
  radius: 0.42,
  radiusScales: [1, 0.93, 0.86],
  belowPanel: 60,
  band: 4,
  slack: 20,
} as const
