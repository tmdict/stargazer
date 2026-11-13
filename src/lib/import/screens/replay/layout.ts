/* Geometry and thresholds of a replay frame, in the pixels of the reference
 * frame, measured on the labelled replay captures. */

// The reference frame's size; the arena picture is a quarter of it.
export const REPLAY_REFERENCE = { width: 1400, height: 1940 } as const
export const ARENA_FACTOR = 4

// The camera in reference pixels: a board point (x, y) on the pointy-top layout
// at unit size, turned by psi to (u, v), lands at
//   d = 1 + p v,  X = cx + sx u / d,  Y = cy + sy v / d,
// a floor tilted away from the viewer with its far rows drawn smaller.
export const CAMERA = {
  psi: 0.009669983444381344,
  p: -0.008121946962408566,
  sx: 97.89599923037078,
  sy: 60.7006522695,
  cx: 760.8041348962155,
  cy: 968.6597521050933,
} as const

// The map strip's five circles in reference pixels. The current map's ring
// measures about a quarter green in its band, the other circles none.
export const STRIP = { x: 505.3, pitch: 120.85, y: 211.3, radius: 44 } as const
export const RING_FLOOR = 0.1

// The placement search: scales around the frame's width over the reference's
// (a crop keeps most of the window's width), shifts up to this fraction of the
// frame. Replay frames score 0.68 to 0.88 though units and effects differ;
// result and formation screens, over the same arena blurred or not at all, 0.13
// to 0.25. Below the floor a frame is not this arena.
export const SCALE_SPREAD = [0.85, 1.18] as const
export const SHIFT_SPREAD = 0.35
export const PLACEMENT_FLOOR = 0.45

// The ring is a thin band, so each circle is tried a few pixels either way of
// where the placement and the measured strip put it.
export const RING_SLACK = [-8, -4, 0, 4, 8] as const
