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
  // leaves the other two as +/- of each other — a single axis).
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
