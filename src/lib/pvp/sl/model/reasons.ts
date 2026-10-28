/* A match-up's chance split into the four reasons, in points of chance. The
 * same part of the edge is worth less near 0% and 100% than near an even
 * match, so a reason's worth depends on the order the reasons are added in;
 * each reason takes its average over all 24 orders (its Shapley value), and
 * the four always add up to the chance less 50%. */

import { sigmoid } from './fit.ts'
import { REASONS, type Reason } from './types.ts'

const orders = (list: readonly Reason[]): Reason[][] =>
  list.length <= 1
    ? [[...list]]
    : list.flatMap((first, i) =>
        orders([...list.slice(0, i), ...list.slice(i + 1)]).map((rest) => [first, ...rest]),
      )

const ORDERS = orders(REASONS)

// Rounded half away from zero, so swapping the teams mirrors every value.
const round = (x: number): number => Math.sign(x) * Math.round(Math.abs(x))

// Each reason's share of the chance, as a fraction toward A.
function reasonShares(parts: Record<Reason, number>): Record<Reason, number> {
  const shares = Object.fromEntries(REASONS.map((r) => [r, 0])) as Record<Reason, number>
  for (const order of ORDERS) {
    let edge = 0
    for (const reason of order) {
      const before = sigmoid(edge)
      edge += parts[reason]
      shares[reason] += (sigmoid(edge) - before) / ORDERS.length
    }
  }
  return shares
}

interface ShownChance {
  // A's chance as shown, in tenths of a point (506 for 50.6%).
  shown: number
  // Each reason in tenths of a point toward A.
  reasons: Record<Reason, number>
}

// The chance from the parts, with each reason rounded so the four add up to
// the shown chance less 50%: when rounding each alone misses, the reasons
// closest to rounding the other way take the difference, one tenth each.
export function splitChance(parts: Record<Reason, number>): ShownChance {
  const chance = sigmoid(REASONS.reduce((sum, r) => sum + parts[r], 0))
  const shares = reasonShares(parts)
  const exact = REASONS.map((r) => shares[r] * 1000)
  const reasons = exact.map(round)
  const shown = round(chance * 1000)
  let missing = shown - 500 - reasons.reduce((sum, x) => sum + x, 0)
  const taken = new Set<number>()
  while (missing !== 0) {
    const step = Math.sign(missing)
    // How far each reason was from rounding the other way, toward the step.
    const lean = (i: number): number => step * (exact[i]! - reasons[i]!)
    let pick = -1
    for (let i = 0; i < exact.length; i++) {
      if (!taken.has(i) && (pick < 0 || lean(i) > lean(pick))) pick = i
    }
    reasons[pick]! += step
    taken.add(pick)
    missing -= step
  }
  return {
    shown,
    reasons: Object.fromEntries(REASONS.map((r, i) => [r, reasons[i]!])) as Record<Reason, number>,
  }
}
