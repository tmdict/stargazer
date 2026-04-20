// Composite scoring weights (sum to 1.0)
export const WEIGHT_BASE = 0.5
export const WEIGHT_SYNERGY = 0.3
export const WEIGHT_COUNTER = 0.2

// Confidence thresholds (used by Wilson score in confidence.ts)
export const CONFIDENCE_HIGH = 10
export const CONFIDENCE_MEDIUM = 5

// Match-prediction confidence (for aggregate + per-model matchup badges).
// Reflects how trustworthy the final probability is, based on the calibrated
// prediction's distance from 50% and across-model agreement.
export const PREDICTION_CONFIDENCE_DESCRIPTIONS: Record<string, string> = {
  high: 'High confidence: calibrated prediction clearly favors one side, and models agree',
  medium: 'Medium confidence: calibrated prediction moderately favors one side',
  low: 'Low confidence: close to 50/50 or models disagree',
}

// Hero data depth (used on recommendation cards). Reflects how much match data
// we have on the hero — not how reliable any specific prediction is.
export const DATA_DEPTH_DESCRIPTIONS: Record<string, string> = {
  high: 'Rich data: hero has been in many matches',
  medium: 'Moderate data: hero has some match history',
  low: 'Sparse data: hero has few recorded matches',
}

// Bradley-Terry
export const BT_MAX_ITERATIONS = 100
export const BT_CONVERGENCE_TOLERANCE = 1e-6
export const BT_LOW_DATA_THRESHOLD = 200

// Pick order for Predict mode (alternating draft)
export const DRAFT_ORDER: [side: 'left' | 'right', slot: number][] = [
  ['left', 0],
  ['right', 0],
  ['right', 1],
  ['left', 1],
  ['left', 2],
  ['right', 2],
]

// Sample size bonus
export const SAMPLE_BONUS_MAX = 0.05
export const SAMPLE_BONUS_FULL = 20

// Meta analysis thresholds
export const META_BAYESIAN_PRIOR = 3.0

/** Win-rate threshold for "notably strong" hero / pair / predicted-team insights. */
export const INSIGHT_NOTABLE_WINRATE = 0.55
/** Max deviation from 50% for a win rate to count as "balanced". */
export const INSIGHT_BALANCED_TOLERANCE = 0.03
/** Min deviation from 50% for composition-pattern insights (class, damage type, range) to surface. */
export const INSIGHT_NOTABLE_DEVIATION = 0.05
/** Pair synergy score threshold — positive for "strong synergy", negated for "strong clash". */
export const INSIGHT_SYNERGY_NOTABLE = 0.05
/** Pair synergy score threshold for softer "clashing pair" callouts. */
export const INSIGHT_SYNERGY_CLASH = 0.03

/**
 * Minimum match count to surface a pair-level insight (synergy, counter,
 * undefeated pair, etc.). sqrt-scaled with the dataset — at ~1,250 matches
 * this returns 9, at 5,000 it's 18. Grows slowly so we never demand absurd
 * evidence, but filters out noisy 3-occurrence patterns when the dataset
 * is large enough that many more candidate pairs exist.
 *
 * | matches | returns |
 * | 500     | 6       |
 * | 1,250   | 9       |
 * | 2,500   | 13      |
 * | 5,000   | 18      |
 * | 10,000  | 25      |
 */
export function metaMinPairMatches(totalMatches: number): number {
  return Math.max(3, Math.ceil(Math.sqrt(totalMatches) / 4))
}

/**
 * Minimum match count to surface a team-level (full-trio) callout insight.
 * Exact-trio repeats are inherently rare (with 87 heroes there are ~107k
 * possible trios), so this stays fairly permissive to surface anything.
 *
 * | matches | returns |
 * | 500     | 2       |
 * | 1,250   | 3       |
 * | 2,500   | 4       |
 * | 5,000   | 5       |
 * | 10,000  | 7       |
 */
export function metaMinTeamMatches(totalMatches: number): number {
  return Math.max(2, Math.ceil(Math.sqrt(totalMatches) / 16))
}

/**
 * Even more permissive team threshold — used by the Meta Teams sortable
 * table, which is a browse/scan UI rather than a curated insight. At
 * typical dataset sizes this floors at 2; grows very slowly so the table
 * always has rows.
 *
 * | matches | returns |
 * | 500     | 2       |
 * | 1,250   | 2       |
 * | 2,500   | 3       |
 * | 5,000   | 3       |
 * | 10,000  | 5       |
 */
export function metaMinTeamMatchesTable(totalMatches: number): number {
  return Math.max(2, Math.ceil(Math.sqrt(totalMatches) / 24))
}

/**
 * Sweep-count threshold for the "Most Dominant Pairs" insight. Sweeps are
 * ~half of all wins so the divisor is larger than the general pair-matches
 * one. Scales with dataset so the highlighted pairs stay genuinely
 * dominant as data grows rather than being 2-sweep coincidences.
 *
 * | matches | returns |
 * | 500     | 3       |
 * | 1,250   | 4       |
 * | 2,500   | 5       |
 * | 5,000   | 8       |
 * | 10,000  | 10      |
 */
export function metaMinPairSweeps(totalMatches: number): number {
  return Math.max(2, Math.ceil(Math.sqrt(totalMatches) / 10))
}

/**
 * Adaptive aggregate-model weights, scaled by dataset size. Used by both
 * the match-prediction aggregate (`recommend.ts`) and the Suggested Teams
 * scoring (`teamSuggestions.ts`).
 *
 * Low data → Popular Pick dominates (works from day one).
 * 100+ matches → Hero Synergy + Team Power hold; Adaptive ML grows modestly.
 * See docs/architecture/WAND_WARS.md §7 "Aggregate Weights" for the table.
 */
export function getAdaptiveAggregateWeights(matchCount: number): Record<string, number> {
  if (matchCount < 20) {
    return { 'popular-pick': 0.55, composite: 0.3, 'bradley-terry': 0.1, 'adaptive-ml': 0.05 }
  }
  if (matchCount <= 100) {
    const t = (matchCount - 20) / 80
    return {
      'popular-pick': 0.55 - 0.25 * t,
      composite: 0.3,
      'bradley-terry': 0.1 + 0.15 * t,
      'adaptive-ml': 0.05 + 0.1 * t,
    }
  }
  const t = Math.min(1, (matchCount - 100) / 400)
  return {
    'popular-pick': 0.3 - 0.05 * t,
    composite: 0.3,
    'bradley-terry': 0.25,
    'adaptive-ml': 0.15 + 0.05 * t,
  }
}

// Pool-screenshot detection (poolDetect.ts).
// `GOLD_*` tune the HSV filter that picks out card borders. `GRID_*` govern
// the auto-crop heuristic (density profile + smoothing), `POOL_*` govern the
// per-cell matching loop.
export const POOL_GOLD_MIN_VALUE = 100 // minimum RGB max (brightness)
export const POOL_GOLD_MIN_DELTA = 30 // minimum saturation (max - min)
export const POOL_GOLD_HUE_MIN = 25 // orange end of the gold hue band (deg)
export const POOL_GOLD_HUE_MAX = 55 // yellow end of the gold hue band (deg)

export const POOL_GRID_MAX_WIDTH = 320 // downscale width for density scan
export const POOL_GRID_SMOOTH_FRACTION = 0.05 // smoothing window as % of axis
export const POOL_GRID_DENSITY_THRESHOLD = 0.02 // row/col "dense" cutoff
export const POOL_GRID_CROP_PAD = 0.01 // padding added to detected crop edges
export const POOL_GRID_EXPECTED_ASPECT = 0.9 // expected grid W/H for 5×4 portrait cards

export const POOL_DEFAULT_ROWS = 4
export const POOL_DEFAULT_COLS = 5
export const POOL_DEFAULT_INSET = 0.02
export const POOL_DEFAULT_ACCEPT_THRESHOLD = 0.5 // 1 - NCC
export const POOL_DEFAULT_OFFSET_RANGE = 0.1 // ±10% of cell size
export const POOL_DEFAULT_OFFSET_STEPS = 5 // 5×5 = 25 offsets per cell
