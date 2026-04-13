/**
 * Wilson score interval for binomial proportion confidence.
 * Returns a confidence level based on the width of the 95% confidence interval.
 *
 * Narrower interval = more confident in the estimate.
 * - High: interval width < 0.3 (tight estimate)
 * - Medium: interval width < 0.5
 * - Low: wide interval or too few samples
 */
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

  if (width < 0.3) return 'high'
  if (width < 0.5) return 'medium'
  return 'low'
}
