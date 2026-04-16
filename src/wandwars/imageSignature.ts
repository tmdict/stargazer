/**
 * Image signature + distance for pool portrait matching.
 *
 * Each portrait is rendered onto a 32x32 canvas with a circular mask (so
 * corner pixels outside the portrait art don't contribute), converted to
 * grayscale luminance, then zero-mean / unit-variance normalized. This
 * produces a Float32Array "fingerprint" that is robust to brightness
 * and contrast differences.
 *
 * Similarity between two signatures is measured via 1 - normalized cross
 * correlation (NCC). Perfect match = 0; unrelated images ≈ 1.
 *
 * This is essentially template matching (TM_CCOEFF_NORMED in OpenCV) but
 * done in ~40 lines with no dependencies.
 */

const SIZE = 32
export const SIGNATURE_LENGTH = SIZE * SIZE

/**
 * Compute a normalized 32x32 circular-masked grayscale signature.
 */
export function computeSignature(source: HTMLImageElement | HTMLCanvasElement): Float32Array {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!

  // Circular clip so background corners don't leak into the signature.
  ctx.save()
  ctx.beginPath()
  ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2)
  ctx.closePath()
  ctx.clip()
  ctx.drawImage(source, 0, 0, SIZE, SIZE)
  ctx.restore()

  const data = ctx.getImageData(0, 0, SIZE, SIZE).data
  const sig = new Float32Array(SIGNATURE_LENGTH)
  for (let i = 0; i < SIGNATURE_LENGTH; i++) {
    const r = data[i * 4]!
    const g = data[i * 4 + 1]!
    const b = data[i * 4 + 2]!
    sig[i] = 0.299 * r + 0.587 * g + 0.114 * b
  }

  // Zero-mean
  let mean = 0
  for (let i = 0; i < SIGNATURE_LENGTH; i++) mean += sig[i]!
  mean /= SIGNATURE_LENGTH
  let varSum = 0
  for (let i = 0; i < SIGNATURE_LENGTH; i++) {
    const v = sig[i]! - mean
    sig[i] = v
    varSum += v * v
  }
  // Unit-variance normalization; fallback to 1 if flat image
  const std = Math.sqrt(varSum / SIGNATURE_LENGTH) || 1
  for (let i = 0; i < SIGNATURE_LENGTH; i++) sig[i]! /= std
  return sig
}

/**
 * Distance between two signatures as 1 - normalized cross correlation.
 * Range: [0, 2]. 0 = identical; ~1 = unrelated; >1 = anticorrelated.
 *
 * In practice, 0.0–0.25 is a strong match, 0.25–0.5 is plausible,
 * >0.5 is usually the wrong hero.
 */
export function signatureDistance(a: Float32Array, b: Float32Array): number {
  let sum = 0
  const n = a.length
  for (let i = 0; i < n; i++) sum += a[i]! * b[i]!
  const ncc = sum / n
  return 1 - ncc
}
