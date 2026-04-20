/**
 * Wilson score interval for binomial proportion confidence.
 * Returns a confidence level based on the width of the 95% confidence interval.
 *
 * Narrower interval = more confident in the estimate.
 * - High ("rich data"):   interval width < 0.20 (~36+ matches near 50% WR)
 * - Medium ("moderate"):  interval width < 0.35 (~12–15 matches near 50% WR)
 * - Low ("sparse"):       wide interval or too few samples
 *
 * Wilson is absolute — these thresholds don't change with dataset size, but
 * the distribution of heroes across the three bands does. Revisit thresholds
 * at major dataset doublings (e.g. ~5,000 matches) if most heroes drift into
 * a single band.
 */
const HIGH_WIDTH = 0.2
const MEDIUM_WIDTH = 0.35

export function wilsonConfidence(successes: number, total: number): 'high' | 'medium' | 'low' {
  if (total < 3) return 'low'

  // z = 1.96 for 95% confidence interval
  const z = 1.96
  const z2 = z * z
  const p = successes / total
  const n = total

  const denominator = 1 + z2 / n
  const centre = (p + z2 / (2 * n)) / denominator
  const margin = (z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n)) / denominator

  const lower = centre - margin
  const upper = centre + margin
  const width = upper - lower

  if (width < HIGH_WIDTH) return 'high'
  if (width < MEDIUM_WIDTH) return 'medium'
  return 'low'
}
