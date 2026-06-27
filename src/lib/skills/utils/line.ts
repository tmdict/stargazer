import { Hex } from '../../hex'

/**
 * Hexes strictly between `a` and `b` along a straight axis.
 *
 * Two hexes are joined by a straight, edge-to-edge line only when they share one
 * cube coordinate (equal q, r, or s); the in-between hexes step one cell at a time
 * along that axis. Returns [] when they aren't collinear (no straight line connects
 * them) or are the same / adjacent (nothing sits between).
 */
export function hexesBetween(a: Hex, b: Hex): Hex[] {
  const dq = b.q - a.q
  const dr = b.r - a.r
  const ds = b.s - a.s

  // Collinear iff one delta is 0 (cube coords sum to 0, so a shared coordinate
  // leaves the other two as +/- of each other, a single axis).
  if (dq !== 0 && dr !== 0 && ds !== 0) return []

  const steps = Math.max(Math.abs(dq), Math.abs(dr), Math.abs(ds))
  const stepQ = Math.sign(dq)
  const stepR = Math.sign(dr)
  const stepS = Math.sign(ds)

  const between: Hex[] = []
  for (let k = 1; k < steps; k++) {
    between.push(new Hex(a.q + stepQ * k, a.r + stepR * k, a.s + stepS * k))
  }
  return between
}

/**
 * The two extreme cells of a constant-s lane within `hexes` (those sharing coordinate
 * `s`): the lowest and highest q, i.e. the lane's SW-most and NE-most cells. Returns
 * null when fewer than two such cells are present (no span to draw).
 */
export function laneSpan(hexes: Hex[], s: number): [Hex, Hex] | null {
  let min: Hex | undefined
  let max: Hex | undefined
  for (const hex of hexes) {
    if (hex.s !== s) continue
    if (!min || hex.q < min.q) min = hex
    if (!max || hex.q > max.q) max = hex
  }
  return min && max && min.getId() !== max.getId() ? [min, max] : null
}

export interface LaneBoundaryClip {
  fromHexId: number
  fromCorner: number
  toHexId: number
  toCorner: number
}

// A lane boundary is shared with the lane one step outward, so a cell in either lane
// meets it. For lane s's outer corner (pointy-top), the cell further out contributes
// the corner two round: the +s side (corner 3) borders lane s+1 at corner 5; the -s
// side (corner 0) borders lane s-1 at corner 2.
const OUTWARD_LANE: Record<number, { ds: number; corner: number }> = {
  3: { ds: 1, corner: 5 },
  0: { ds: -1, corner: 2 },
}

// 2q + r + this is proportional to a boundary vertex's pixel x, which rises
// monotonically toward the NE, so it orders the vertices without any layout math.
const CORNER_NE_BIAS: Record<number, number> = { 0: 1, 2: -1, 3: -1, 5: 1 }

/**
 * Clip a constant-s lane boundary to `hexes`. The line runs along `corner` of lane `s`,
 * but the boundary is shared with the lane one step outward, so cells in EITHER lane
 * bound it: the run spans the SW-most to the NE-most such cell, each contributing the
 * corner it meets the boundary at. Returns null when fewer than two distinct boundary
 * vertices are present. Used to extend/clip a wedge edge to the shown region.
 */
export function clipLaneBoundary(hexes: Hex[], s: number, corner: number): LaneBoundaryClip | null {
  const outward = OUTWARD_LANE[corner]
  if (!outward) return null
  let sw: { hex: Hex; corner: number; key: number } | undefined
  let ne: { hex: Hex; corner: number; key: number } | undefined
  for (const hex of hexes) {
    let c: number
    if (hex.s === s) c = corner
    else if (hex.s === s + outward.ds) c = outward.corner
    else continue
    const key = 2 * hex.q + hex.r + CORNER_NE_BIAS[c]!
    if (!sw || key < sw.key) sw = { hex, corner: c, key }
    if (!ne || key > ne.key) ne = { hex, corner: c, key }
  }
  if (!sw || !ne || sw.key === ne.key) return null
  return {
    fromHexId: sw.hex.getId(),
    fromCorner: sw.corner,
    toHexId: ne.hex.getId(),
    toCorner: ne.corner,
  }
}
