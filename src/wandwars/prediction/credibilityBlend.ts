/** One model's vote: its (calibrated) win probability and self-confidence. */
export interface ModelVote {
  id: string
  probability: number
  selfConfidence: number
}

export interface CredibilityBlend {
  /** Credibility-weighted mean probability */
  probability: number
  /** Weighted stddev of the votes around the mean — the disagreement metric */
  weightedStddev: number
  /** Weighted mean of per-model self-confidences */
  avgSelfConfidence: number
}

// Weight for a model id missing from the aggregate-weight table
const DEFAULT_WEIGHT = 0.25

/**
 * Credibility-weighted blend of model predictions — the single definition of
 * the aggregate math shared by the runtime (getAggregatePrediction) and the
 * benchmark's threshold tuning. The confidence thresholds in
 * calibrationData.ts are fit against exactly this computation, so the badge
 * calibration depends on both sides using this one function.
 *
 * Credibility weight = aggregate weight × self-confidence: low-confidence
 * models are downweighted in the probability blend and the disagreement
 * metric alike, so a sparse-data outlier doesn't torpedo a prediction the
 * high-confidence models agree on. Falls back to plain aggregate weights when
 * every self-confidence is 0 (possible for brand-new heroes) to avoid a
 * division-by-zero collapse.
 */
export function computeCredibilityBlend(
  votes: ModelVote[],
  baseWeights: Record<string, number>,
): CredibilityBlend {
  let totalCredibility = 0
  const credibility: Record<string, number> = {}
  for (const vote of votes) {
    const cred = (baseWeights[vote.id] ?? DEFAULT_WEIGHT) * vote.selfConfidence
    credibility[vote.id] = cred
    totalCredibility += cred
  }

  let totalWeight: number
  const weights: Record<string, number> = {}
  if (totalCredibility > 0) {
    totalWeight = totalCredibility
    Object.assign(weights, credibility)
  } else {
    totalWeight = 0
    for (const vote of votes) {
      const w = baseWeights[vote.id] ?? DEFAULT_WEIGHT
      weights[vote.id] = w
      totalWeight += w
    }
  }

  // Weighted mean prediction
  let probability = 0
  for (const vote of votes) {
    probability += (weights[vote.id]! / totalWeight) * vote.probability
  }

  // Weighted variance around the weighted mean
  let variance = 0
  for (const vote of votes) {
    variance += (weights[vote.id]! / totalWeight) * (vote.probability - probability) ** 2
  }

  // Weighted mean self-confidence
  let avgSelfConfidence = 0
  for (const vote of votes) {
    avgSelfConfidence += (weights[vote.id]! / totalWeight) * vote.selfConfidence
  }

  return { probability, weightedStddev: Math.sqrt(variance), avgSelfConfidence }
}
