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
export const META_MIN_TEAM_MATCHES = 2
export const META_MIN_PAIR_MATCHES = 3

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
