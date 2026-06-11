/**
 * Bayesian-smoothed win rate over decisive results: `prior` virtual wins and
 * losses pull sparse records toward 0.5, fading as evidence grows.
 *
 * This is the single implementation of the rate formula for the analysis
 * layer, Popular Pick, and team suggestions. The denominator is derived from
 * the two evidence arguments, so draws are excluded by construction — a draw
 * can only influence a rate if a caller miscounts it as a win or a loss.
 *
 * Zero evidence returns exactly 0.5 (requires prior > 0).
 */
export function smoothedWinRate(
  weightedWins: number,
  weightedLosses: number,
  prior: number,
): number {
  return (weightedWins + prior) / (weightedWins + weightedLosses + 2 * prior)
}
