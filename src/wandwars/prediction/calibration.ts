/**
 * Probability calibration — maps raw model outputs to empirically-calibrated
 * probabilities fit from held-out benchmark data.
 *
 * Calibration is fit offline by `benchmark.ts` via 5-fold CV and exported as
 * `calibrationData.ts`. At inference, `calibrate(modelId, rawProb)` returns the
 * calibrated probability; if no table exists for a model, the raw value is
 * returned unchanged.
 */

import { CALIBRATION, type Calibration } from './calibrationData'

/** Piecewise-linear isotonic lookup. Bins are sorted by rawProb ascending. */
export function isotonicApply(
  bins: { rawProb: number; calibratedProb: number }[],
  x: number,
): number {
  if (bins.length === 0) return x
  if (x <= bins[0]!.rawProb) return bins[0]!.calibratedProb
  if (x >= bins[bins.length - 1]!.rawProb) return bins[bins.length - 1]!.calibratedProb
  // Linear interpolation between adjacent bins
  for (let i = 1; i < bins.length; i++) {
    const a = bins[i - 1]!
    const b = bins[i]!
    if (x <= b.rawProb) {
      const t = (x - a.rawProb) / (b.rawProb - a.rawProb)
      return a.calibratedProb + t * (b.calibratedProb - a.calibratedProb)
    }
  }
  return x
}

/** Platt scaling: calibrated = 1 / (1 + exp(a * raw + b)). */
export function plattApply(a: number, b: number, x: number): number {
  const z = a * x + b
  if (z > 20) return 0
  if (z < -20) return 1
  return 1 / (1 + Math.exp(z))
}

export function calibrate(modelId: string, rawProb: number): number {
  const cal: Calibration | undefined = CALIBRATION[modelId]
  if (!cal || cal.method === 'identity') return rawProb
  if (cal.method === 'platt' && cal.platt) return plattApply(cal.platt.a, cal.platt.b, rawProb)
  if (cal.method === 'isotonic' && cal.bins) return isotonicApply(cal.bins, rawProb)
  return rawProb
}

export type { Calibration } from './calibrationData'

export function hasCalibration(modelId: string): boolean {
  const cal = CALIBRATION[modelId]
  return !!cal && cal.method !== 'identity'
}
