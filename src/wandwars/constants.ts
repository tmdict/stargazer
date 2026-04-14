// Composite scoring weights (sum to 1.0)
export const WEIGHT_BASE = 0.5
export const WEIGHT_SYNERGY = 0.3
export const WEIGHT_COUNTER = 0.2

// Confidence thresholds (used by Wilson score in confidence.ts)
export const CONFIDENCE_HIGH = 10
export const CONFIDENCE_MEDIUM = 5

// Confidence tooltip descriptions
export const CONFIDENCE_DESCRIPTIONS: Record<string, string> = {
  high: 'High confidence: sufficient match data',
  medium: 'Medium confidence: limited match data',
  low: 'Low confidence: very few matches',
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

// Max recommendations to show
export const MAX_RECOMMENDATIONS = 30

// Meta analysis thresholds
export const META_BAYESIAN_PRIOR = 3.0
export const META_MIN_TEAM_MATCHES = 2
export const META_MIN_PAIR_MATCHES = 3
