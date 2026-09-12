/* Refinement from the star row above the face. Stars are bright blobs with
 * dark gaps between them: the row is the brightest seven-row band in the
 * outer thirds of the frame's top (the centre crown never reaches there),
 * the count is the number of peaks across it, and the colour family comes
 * from the bright pixels at the peaks. Fewer than six stars cannot be
 * refined, so a short row is R0 whatever its colour. */

import { hsvAt } from './image'
import type { Rect, RefinementReading, RgbaImage, StarFamily } from './types'

const BAND_ROWS = 7
const SEARCH_DEPTH = 0.24
const BRIGHT = 0.78
const PEAK_BRIGHT = 0.72
const PEAK_MIN_DISTANCE = 6
// Six stars span most of the frame width; four or fewer peaks is a short row
// beyond doubt, five may be two merged stars, so only four gates.
const SHORT_ROW = 4

const findBand = (shot: RgbaImage, box: Rect): Rect => {
  const x0 = box.x + Math.round(box.w * 0.1)
  const x1 = box.x + Math.round(box.w * 0.9)
  const inner0 = box.x + box.w * 0.36
  const inner1 = box.x + box.w * 0.64
  const depth = Math.round(box.h * SEARCH_DEPTH)
  const rowScore: number[] = []
  for (let y = box.y; y < box.y + depth; y++) {
    let c = 0
    if (y >= 0 && y < shot.height) {
      for (let x = x0; x < x1; x++) {
        if (x < 0 || x >= shot.width || (x > inner0 && x < inner1)) continue
        if (hsvAt(shot, x, y)[2] > BRIGHT) c++
      }
    }
    rowScore.push(c)
  }
  let bestTop = 0
  let bestSum = -1
  for (let k = 0; k + BAND_ROWS <= rowScore.length; k++) {
    let sum = 0
    for (let r = 0; r < BAND_ROWS; r++) sum += rowScore[k + r]!
    if (sum > bestSum) {
      bestSum = sum
      bestTop = k
    }
  }
  return { x: x0, y: box.y + bestTop, w: x1 - x0, h: BAND_ROWS }
}

/* Column peaks of the band's bright pixels: one per star. */
const findPeaks = (shot: RgbaImage, band: Rect): number[] => {
  const profile: number[] = []
  for (let x = band.x; x < band.x + band.w; x++) {
    let c = 0
    for (let y = band.y; y < band.y + band.h; y++) {
      if (x < 0 || y < 0 || x >= shot.width || y >= shot.height) continue
      if (hsvAt(shot, x, y)[2] > PEAK_BRIGHT) c++
    }
    profile.push(c)
  }
  const smooth = profile.map(
    (_, i) => (profile[i - 1] ?? 0) + 2 * profile[i]! + (profile[i + 1] ?? 0),
  )
  const max = Math.max(...smooth)
  if (max === 0) return []
  const peaks: number[] = []
  for (let i = 0; i < smooth.length; i++) {
    const v = smooth[i]!
    if (v < max * 0.5) continue
    if (v < (smooth[i - 1] ?? 0) || v < (smooth[i + 1] ?? 0)) continue
    const last = peaks[peaks.length - 1]
    if (last !== undefined && i - last < PEAK_MIN_DISTANCE) {
      if (v > smooth[last]!) peaks[peaks.length - 1] = i
      continue
    }
    peaks.push(i)
  }
  return peaks.map((i) => band.x + i)
}

export function readStars(shot: RgbaImage, box: Rect): RefinementReading {
  const band = findBand(shot, box)
  const peaks = findPeaks(shot, band)
  const stars = Math.min(6, peaks.length)

  // Colour from bright pixels near the peaks, so a hat or crown under the
  // row does not tint the reading.
  const hist = new Array<number>(12).fill(0)
  let n = 0
  let cx = 0
  let cy = 0
  for (let y = band.y; y < band.y + band.h; y++) {
    for (let x = band.x; x < band.x + band.w; x++) {
      if (x < 0 || y < 0 || x >= shot.width || y >= shot.height) continue
      if (peaks.length >= 2 && !peaks.some((p) => Math.abs(p - x) <= 4)) continue
      const [h, s, v] = hsvAt(shot, x, y)
      if (v < BRIGHT) continue
      n++
      cx += s * Math.cos((h * Math.PI) / 180)
      cy += s * Math.sin((h * Math.PI) / 180)
      if (s > 0.15) hist[Math.floor(h / 30)]! += 1
    }
  }
  const share = hist.map((c) => c / (n || 1))
  const chroma = Math.hypot(cx, cy) / (n || 1)
  const gold = share[1]! + share[2]!
  const red = share[0]! + share[11]!
  const purple = share[8]! + share[9]!
  const magenta = share[10]! + share[11]!

  let family: StarFamily = 'white'
  let level = magenta >= 0.03 ? 4 : 0
  if (chroma >= 0.25 && gold >= 0.4) {
    family = 'gold'
    level = 2
  } else if (chroma >= 0.25 && red >= 0.3) {
    family = 'red'
    level = 3
  } else if (purple >= 0.2) {
    family = 'purple'
    level = 1
  }
  if (stars <= SHORT_ROW) level = 0
  return { level, stars, family }
}
