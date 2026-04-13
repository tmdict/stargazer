// Composite scoring weights
export const WEIGHT_BASE = 0.5
export const WEIGHT_SYNERGY = 0.3
export const WEIGHT_COUNTER = 0.2

// Confidence thresholds
export const CONFIDENCE_HIGH = 10
export const CONFIDENCE_MEDIUM = 5

// Bradley-Terry
export const BT_MAX_ITERATIONS = 100
export const BT_CONVERGENCE_TOLERANCE = 1e-6
export const BT_LOW_DATA_THRESHOLD = 200

// Pick order for Predict mode (alternating draft)
// Each entry: [side, slotIndex]
export const DRAFT_ORDER: [side: 'left' | 'right', slot: number][] = [
  ['left', 0], // Pick 1: Left picks 1st
  ['right', 0], // Pick 2: Right picks 1st
  ['right', 1], // Pick 3: Right picks 2nd
  ['left', 1], // Pick 4: Left picks 2nd
  ['left', 2], // Pick 5: Left picks 3rd
  ['right', 2], // Pick 6: Right picks 3rd
]

// Sample size bonus: heroes with more appearances get a slight score boost
// Ramps from 0 at 0 matches to SAMPLE_BONUS_MAX at SAMPLE_BONUS_FULL matches
export const SAMPLE_BONUS_MAX = 0.05
export const SAMPLE_BONUS_FULL = 20

// Max recommendations to show
export const MAX_RECOMMENDATIONS = 10
