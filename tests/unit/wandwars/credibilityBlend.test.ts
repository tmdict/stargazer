import { describe, expect, it } from 'vitest'

import { computeCredibilityBlend } from '@/wandwars/prediction/credibilityBlend'

// The badge calibration depends on this exact math (thresholds in
// calibrationData.ts are fit against it), so the values are pinned by hand.
describe('computeCredibilityBlend', () => {
  const weights = { a: 0.5, b: 0.5 }

  it('blends by credibility = weight × self-confidence', () => {
    const blend = computeCredibilityBlend(
      [
        { id: 'a', probability: 0.6, selfConfidence: 0.8 }, // cred 0.4
        { id: 'b', probability: 0.4, selfConfidence: 0.4 }, // cred 0.2
      ],
      weights,
    )
    // μ = (0.4·0.6 + 0.2·0.4) / 0.6
    expect(blend.probability).toBeCloseTo(0.53333, 4)
    // √[ (0.4/0.6)(0.6−μ)² + (0.2/0.6)(0.4−μ)² ]
    expect(blend.weightedStddev).toBeCloseTo(0.09428, 4)
    // (0.4/0.6)·0.8 + (0.2/0.6)·0.4
    expect(blend.avgSelfConfidence).toBeCloseTo(0.66667, 4)
  })

  it('falls back to plain aggregate weights when all self-confidences are 0', () => {
    const blend = computeCredibilityBlend(
      [
        { id: 'a', probability: 0.6, selfConfidence: 0 },
        { id: 'b', probability: 0.4, selfConfidence: 0 },
      ],
      weights,
    )
    expect(blend.probability).toBeCloseTo(0.5, 6)
    expect(blend.weightedStddev).toBeCloseTo(0.1, 6)
    expect(blend.avgSelfConfidence).toBe(0)
  })

  it('gives ids missing from the weight table a nonzero default weight', () => {
    const blend = computeCredibilityBlend(
      [
        { id: 'x', probability: 0.7, selfConfidence: 0.5 },
        { id: 'y', probability: 0.3, selfConfidence: 0.5 },
      ],
      {},
    )
    // Equal default weights + equal self-confidence → plain mean
    expect(blend.probability).toBeCloseTo(0.5, 6)
    expect(blend.avgSelfConfidence).toBeCloseTo(0.5, 6)
  })

  it('excludes a zero-confidence vote when peers have confidence', () => {
    const blend = computeCredibilityBlend(
      [
        { id: 'a', probability: 0.9, selfConfidence: 0 }, // cred 0 — no influence
        { id: 'b', probability: 0.4, selfConfidence: 0.5 },
      ],
      weights,
    )
    expect(blend.probability).toBeCloseTo(0.4, 6)
    expect(blend.weightedStddev).toBeCloseTo(0, 6)
    expect(blend.avgSelfConfidence).toBeCloseTo(0.5, 6)
  })

  it('a unanimous panel has zero disagreement', () => {
    const blend = computeCredibilityBlend(
      [
        { id: 'a', probability: 0.65, selfConfidence: 0.9 },
        { id: 'b', probability: 0.65, selfConfidence: 0.2 },
      ],
      weights,
    )
    expect(blend.probability).toBeCloseTo(0.65, 6)
    expect(blend.weightedStddev).toBeCloseTo(0, 6)
  })
})
