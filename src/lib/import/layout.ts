/* Geometry of a result screenshot, in the pixels of the shot normalised to
 * CANONICAL_WIDTH. Nominal positions only seed the searches (frames.ts
 * anchors the ally card column, the enemy column sits a fixed distance
 * below it, and every other region derives from those anchors); the ratios
 * are the game's layout and hold across the phone sizes measured. The one
 * invariant is the width: a crop must keep the full screen width, since the
 * game lays the panel out from it; a raw, uncropped capture qualifies, and
 * its column is found by a whole-height scan when the nominal spot fails. */

import { Team } from '@/lib/types/team'

export const CANONICAL_WIDTH = 1150

// The portrait column: card frames stacked at a fixed pitch in each panel.
// The pitch and the gap between the panels shift by a few percent between
// phone shapes, so both are settled per shot around these nominals.
export const CARD_COLUMN_X = 38
export const CARD_ROWS = 5
export const CARD_PITCH = 99.5
export const CARD_PITCH_RANGE = [95, 104] as const
export const CARD_TOP: Record<Team, number> = { [Team.ALLY]: 237, [Team.ENEMY]: 947 }

// Anchor search around the nominal column, and the per-card search around the anchor.
export const ANCHOR_SEARCH = { oy: [-60, 40], ox: [-16, 16], step: 4 } as const
export const CARD_SEARCH = { oy: 6, ox: 4, step: 1 } as const
export const ANCHOR_FLOOR = 0.35
// The whole-height scan may accept a weaker pair: its two combs a panel gap
// apart with a summary bar under each are already strong structure, and a
// capture taken while the panel was still fading in scores its frames low.
export const SCAN_FLOOR = 0.27

// The enemy column starts this far below the ally column in a crop; a
// taller phone spreads the panels further apart.
export const PANEL_GAP = CARD_TOP[Team.ENEMY] - CARD_TOP[Team.ALLY]
export const PANEL_GAP_RANGE = [620, 900] as const

// Whole-height scan for the card columns (a raw capture, whose column also
// sits further right than in a crop): one frame scale, a row profile at this
// step, the fine anchor search then settles offset and scale. The two columns
// are scored as a pair a panel gap apart, which no background pattern imitates.
export const COLUMN_SCAN = { step: 4, ox: [-16, -8, 0, 8, 16, 24, 32], scale: 0.25 } as const

// The face inside a matched frame: fractions of the frame box. Only the upper
// part of the art is used, since the badges and the frame's white swirl
// cover the rest.
export const ART_BOX = { x: 0.23, y: 0.2, w: 0.69, aspect: 36 / 48 } as const

// The round artifact icon under each player name, relative to the ally
// column anchor (the header sits a fixed distance above the first card).
export const HEADER_ICON: { dx: Record<Team, number>; dy: number; diameter: number } = {
  dx: { [Team.ALLY]: 171, [Team.ENEMY]: 884 },
  dy: -146,
  diameter: 66,
}

// The Ally tab, relative to the ally column anchor: orange when the top team
// won this map, blue when it lost. Used when the tabs were not found outright.
export const TAB_REGION = { dx: -18, dy: -62, w: 100, h: 30 } as const

// The Ally and Enemy tabs as landmarks: each is a solid orange or blue block
// (that team's result on this map) at the panel's top left, beside the
// panel's dark header row, and its team's first card starts just under it.
// Rows where the left strip is mostly that colour and the header row beside
// it is mostly dark are tab rows; a run of them the height of a tab is a tab.
export const TABS = {
  x: [10, 180],
  darkX: [180, 420],
  fill: 0.6,
  dark: 0.25,
  height: [40, 100],
  // Ally tab top to enemy tab top.
  gap: [400, 1100],
  toCard: 8,
} as const
// The column is searched more widely sideways under a tab, since a taller
// phone puts it further from the panel's edge.
export const TAB_ANCHOR_OX = [-16, 40] as const

// The solid bar of the summary row under a panel's fifth card (orange for
// the ally panel, blue for the enemy), relative to the column anchor's
// x and the fifth card's top: what tells a real column from the same five
// rows started one row too high, at the tab, which matches a frame well.
export const SUMMARY_BAR = { dx: [150, 900], dy: [110, 150] } as const

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
