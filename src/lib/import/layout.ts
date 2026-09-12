/* Geometry of a hand-cropped result screenshot, in the pixels of the shot
 * normalised to CANONICAL_WIDTH. Nominal positions only seed the searches
 * (frames.ts anchors the two card columns and every other region derives
 * from those anchors); the ratios are the game's layout and hold across the
 * phone sizes measured. Raw, uncropped captures need a whole-image anchor
 * pass in front of this and are not handled yet. */

import { Team } from '@/lib/types/team'

export const CANONICAL_WIDTH = 1150

// The portrait column: card frames stacked at a fixed pitch in each panel.
export const CARD_COLUMN_X = 38
export const CARD_ROWS = 5
export const CARD_PITCH = 99.5
export const CARD_TOP: Record<Team, number> = { [Team.ALLY]: 237, [Team.ENEMY]: 947 }

// Anchor search around the nominal column, and the per-card search around the anchor.
export const ANCHOR_SEARCH = { oy: [-60, 40], ox: [-16, 16], step: 4 } as const
export const CARD_SEARCH = { oy: 6, ox: 4, step: 2 } as const
export const ANCHOR_FLOOR = 0.35

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
// won this map, blue when it lost.
export const TAB_REGION = { dx: -18, dy: -62, w: 100, h: 30 } as const

// The map strip: circles at a fixed pitch (a fraction of the width, the same
// for three and five circles) centred on the image, below the enemy panel.
export const STRIP = { pitch: 0.0887, centre: 0.49, radius: 0.42, belowPanel: 60 } as const
