// Composite scoring weights (sum to 1.0)
export const WEIGHT_BASE = 0.5
export const WEIGHT_SYNERGY = 0.3
export const WEIGHT_COUNTER = 0.2

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

// Bayesian prior strength (pseudo-matches) for win-rate smoothing.
export const META_BAYESIAN_PRIOR = 3.0

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
