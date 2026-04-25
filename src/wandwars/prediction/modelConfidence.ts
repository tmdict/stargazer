/**
 * Per-model self-confidence signals — each model answers the question:
 * "Do I have the ingredients I need to make a reliable prediction for this
 * specific matchup?"
 *
 * Each function returns a score in [0, 1] where:
 *   1.0 = model has strong data/context for this matchup
 *   0.0 = model is falling back to priors / near-no signal
 *
 * The four signals are deliberately different because the four models rely
 * on different data:
 *   - Popular Pick → avg teammate-pair match count
 *   - Composite   → avg synergy + counter matrix data strength
 *   - Team Power  → inverse of pair-interaction-residual magnitude
 *   - Adaptive ML → avg teammate-pair co-occurrence (combinatorial familiarity)
 *
 * Every signal is empirically validated by `benchmark.ts` — the tuner
 * verifies that the "low self-confidence" subset is actually ≥ 1pp less
 * accurate than the typical subset on held-out CV. Signals that don't
 * clear that check get replaced.
 *
 * Consumed by `recommend.ts` for:
 *   1. Per-model confidence badges
 *   2. Credibility weighting in the aggregate probability (low-confidence
 *      models contribute less to the blended win %, not just to the badge)
 *   3. Aggregate confidence badge (credibility-weighted stddev + avgSelfConf)
 *
 * And by `benchmark.ts` for per-model + aggregate threshold tuning.
 */

import type { AnalysisData } from '../types'
import type { BradleyTerryFit } from './bradleyTerry'

// Normalization constants — each picked for the signal's natural scale at
// the current dataset size. The benchmark tuner picks per-model thresholds
// over these normalized [0,1] values, so the exact constants here just
// affect the shape of the signal, not the final badge cutoffs.
const POPULAR_PICK_FULL_PAIR_MATCHES = 10
const COMPOSITE_FULL_DATA_STRENGTH = 10
// B-T signal: exp(−α × Σ|pair-residual|) over the 6 teammate pairs.
// α = 6 gives sumAbs = 0 → 1.0, 0.1 → 0.55, 0.2 → 0.30, 0.3 (max) → 0.17.
// B-T's pair residuals are structurally bimodal at current data size —
// ~40% of matchups have clean additive fits, ~60% have significant pair
// overrides, with a ~5pp accuracy gap. The tuner lets LOW land wherever
// the data supports it; see WAND_WARS.md §7 for the shape.
const BRADLEY_TERRY_RESIDUAL_ALPHA = 6
// NN signal: avg teammate-pair co-occurrence, normalized by 5 matches.
// Avg (not min) gives a smoother distribution — min collapses to 0 for
// any matchup where a single pair never co-occurred, flattening the
// signal into two bins. Avg spreads the signal continuously.
const ADAPTIVE_ML_FULL_PAIR_MATCHES = 5

/**
 * Popular Pick relies on pair records and contextual win rates. Its self-
 * confidence tracks how many matches we've actually seen with these specific
 * teammate pairs — when the pair record is thin, PP falls back to overall
 * win rates and its answer is weaker.
 *
 * Signal: average (teammate) pair match count across the 6 team pairs,
 * normalized by POPULAR_PICK_FULL_PAIR_MATCHES.
 */
export function popularPickSelfConfidence(
  leftTeam: string[],
  rightTeam: string[],
  analysis: AnalysisData,
): number {
  const teamPairs: [string, string][] = [...allPairs(leftTeam), ...allPairs(rightTeam)]
  if (teamPairs.length === 0) return 0
  let total = 0
  for (const [a, b] of teamPairs) {
    total += analysis.synergyMatrix[a]?.[b]?.matches ?? 0
  }
  const avg = total / teamPairs.length
  return Math.min(1, avg / POPULAR_PICK_FULL_PAIR_MATCHES)
}

/**
 * Composite explicitly scales its synergy/counter weights by a per-pair
 * `dataStrength = min(1, matchCount / 10)`. When a pair hasn't co-occurred
 * enough, the synergy weight collapses and weight flows to the base win
 * rate — the model literally tells us it's "guessing from individuals".
 *
 * Signal: average of (synergy data strength, counter data strength) across
 * the 6 teammate pairs and 9 opposing-hero matchups.
 */
export function compositeSelfConfidence(
  leftTeam: string[],
  rightTeam: string[],
  analysis: AnalysisData,
): number {
  const synergyPairs = [...allPairs(leftTeam), ...allPairs(rightTeam)]
  const counterPairs: [string, string][] = []
  for (const l of leftTeam) for (const r of rightTeam) counterPairs.push([l, r])

  const synergyStrength =
    synergyPairs.length === 0
      ? 0
      : synergyPairs.reduce((acc, [a, b]) => {
          const matches = analysis.synergyMatrix[a]?.[b]?.matches ?? 0
          return acc + Math.min(1, matches / COMPOSITE_FULL_DATA_STRENGTH)
        }, 0) / synergyPairs.length

  const counterStrength =
    counterPairs.length === 0
      ? 0
      : counterPairs.reduce((acc, [a, b]) => {
          const matches = analysis.counterMatrix[a]?.[b]?.matches ?? 0
          return acc + Math.min(1, matches / COMPOSITE_FULL_DATA_STRENGTH)
        }, 0) / counterPairs.length

  return (synergyStrength + counterStrength) / 2
}

/**
 * Bradley-Terry fits team strengths additively (Σλ), then computes pair
 * interaction *residuals* that capture what the additive model misses.
 * Large residuals mean "pair data strongly disagrees with additive-strength
 * prediction" — B-T's two sub-components are fighting and the answer is
 * less reliable.
 *
 * Signal: `exp(−α × Σ|residual|)` across 6 teammate pairs. High = additive
 * strengths fit cleanly; low = pair data is overriding heavily.
 *
 * Why not data-quantity (match counts)? Tried and empirically failed —
 * low-data B-T predictions regularize toward 50% and are "accidentally
 * right" on close matches, so match-count signals don't correlate with
 * held-out accuracy. Residual magnitude is a genuine per-matchup
 * uncertainty signal (verified by the tuner's drop check).
 */
export function bradleyTerrySelfConfidence(
  leftTeam: string[],
  rightTeam: string[],
  btFit?: BradleyTerryFit,
): number {
  // Fallback when no fit is available (edge case during initialization).
  // Returns neutral signal so the tuner doesn't accidentally treat an
  // uninitialized state as low-confidence.
  if (!btFit) return 0.5

  const teamPairs: [string, string][] = [...allPairs(leftTeam), ...allPairs(rightTeam)]
  let totalAbsResidual = 0
  for (const [a, b] of teamPairs) {
    const key = [a, b].sort().join(',')
    totalAbsResidual += Math.abs(btFit.interactions.get(key) ?? 0)
  }
  return Math.exp(-BRADLEY_TERRY_RESIDUAL_ALPHA * totalAbsResidual)
}

/**
 * Adaptive ML's 16-dim embeddings are trained team-wise (leftSum − rightSum),
 * so the axis that matters is *combinatorial* — how well has the NN seen
 * these specific hero *interactions*, not just each hero in isolation.
 *
 * Signal: avg teammate-pair co-occurrence (synergy matrix match counts)
 * across the 6 pairs, normalized by ADAPTIVE_ML_FULL_PAIR_MATCHES.
 *
 * Why not per-hero match count? Tried and empirically failed — same
 * regularization-to-50% artifact as B-T above. Pair co-occurrence better
 * matches what team-sum embeddings actually depend on.
 */
export function adaptiveMLSelfConfidence(
  leftTeam: string[],
  rightTeam: string[],
  analysis: AnalysisData,
): number {
  const teamPairs: [string, string][] = [...allPairs(leftTeam), ...allPairs(rightTeam)]
  if (teamPairs.length === 0) return 0
  const totalMatches = teamPairs.reduce(
    (acc, [a, b]) => acc + (analysis.synergyMatrix[a]?.[b]?.matches ?? 0),
    0,
  )
  const avgMatches = totalMatches / teamPairs.length
  return Math.min(1, avgMatches / ADAPTIVE_ML_FULL_PAIR_MATCHES)
}

/** Compute self-confidence for all four models in one call. */
export function computeAllSelfConfidences(
  leftTeam: string[],
  rightTeam: string[],
  analysis: AnalysisData,
  btFit?: BradleyTerryFit,
): Record<string, number> {
  return {
    'popular-pick': popularPickSelfConfidence(leftTeam, rightTeam, analysis),
    composite: compositeSelfConfidence(leftTeam, rightTeam, analysis),
    'bradley-terry': bradleyTerrySelfConfidence(leftTeam, rightTeam, btFit),
    'adaptive-ml': adaptiveMLSelfConfidence(leftTeam, rightTeam, analysis),
  }
}

// ---- Helpers ----

/** Enumerate the 3 unordered pairs within a 3-hero team. */
function allPairs(team: string[]): [string, string][] {
  const out: [string, string][] = []
  for (let i = 0; i < team.length; i++) {
    for (let j = i + 1; j < team.length; j++) {
      out.push([team[i]!, team[j]!])
    }
  }
  return out
}
