/* Refinement from the star row above the face. The row starts a fixed
 * distance above the card box's centre, and the seven-row band with the most
 * bright pixels within ROW_SLACK rows of there absorbs the frame match's
 * residual error. Stars are bright blobs with dark gaps between them: the
 * count is the number of peaks across the band, and the colour family comes
 * from the bright pixels at the peaks. A row gains a star every five
 * exclusive-weapon levels, and refinement starts only once it holds six, so a
 * short row is R0. It waits for review when a refined family's colour is
 * strong, as two stars can merge or one hide on a blurred capture.
 *
 * Bright headwear beside an unrefined row (a hat, a crown, coloured hair)
 * can add peaks at its ends and tint the colour toward a refined family, so
 * a refined reading is sure only when its family's evidence is strong: a
 * real refined row is one colour from end to end. A full R4 row, a pale
 * rainbow, stands out from R0 mainly by a faint pink tint, which resampling
 * can halve, so R0 is sure only when the row has none. */

import { hsvAt } from './image'
import type { Rect, RefinementReading, RgbaImage, StarFamily } from './types'

const BAND_ROWS = 7
// The framed shot gives every card one size, and a frame matched a little
// larger or smaller sits around the same card, so the row's top is this many
// pixels above the box's centre whatever frame and scale matched (37.5 to 40.5
// on labelled screenshots). The brightest band near the card's top is often
// not the row but the winged frame's white band, or hair or a hat under the row.
const ROW_ABOVE_CENTRE = 39
const ROW_SLACK = 2
const BRIGHT = 0.78
const PEAK_BRIGHT = 0.72
const PEAK_MIN_DISTANCE = 6
// Evidence a refined reading needs to be sure, about 85% of the weakest
// correctly read row of each level on labelled screenshots: the purple share
// (R1), colour strength and gold share (R2), red share (R3), and the share of
// stars that carry the pink tint on their own (R4). A full R0 row is sure
// under a pink share of `r0Pink`: unrefined rows measure below 0.005, R4 rows
// above 0.04.
const SURE = {
  purple: 0.58,
  chroma: 0.29,
  gold: 0.5,
  red: 0.37,
  pinkStars: 0.38,
  r0Pink: 0.01,
} as const
const PINK = 0.03
// Read where the card puts the row, every refined row on labelled screenshots
// counts six peaks, so a row of five peaks is short.
const SHORT_ROW = 5

const findBand = (shot: RgbaImage, box: Rect): Rect => {
  const x0 = box.x + Math.round(box.w * 0.1)
  const x1 = box.x + Math.round(box.w * 0.9)
  const at = box.y + Math.round(box.h / 2) - ROW_ABOVE_CENTRE
  let bestTop = at
  let bestSum = -1
  for (let top = at - ROW_SLACK; top <= at + ROW_SLACK; top++) {
    let sum = 0
    for (let y = Math.max(0, top); y < Math.min(shot.height, top + BAND_ROWS); y++) {
      for (let x = Math.max(0, x0); x < Math.min(shot.width, x1); x++) {
        if (hsvAt(shot, x, y)[2] > BRIGHT) sum++
      }
    }
    if (sum > bestSum) {
      bestSum = sum
      bestTop = top
    }
  }
  return { x: x0, y: bestTop, w: x1 - x0, h: BAND_ROWS }
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

/* The share of the row's stars whose own bright pixels carry the pink tint. */
const pinkStarShare = (shot: RgbaImage, band: Rect, peaks: readonly number[]): number => {
  let pink = 0
  for (const p of peaks) {
    let n = 0
    let m = 0
    for (let y = band.y; y < band.y + band.h; y++) {
      for (let x = p - 4; x <= p + 4; x++) {
        if (x < 0 || y < 0 || x >= shot.width || y >= shot.height) continue
        const [h, s, v] = hsvAt(shot, x, y)
        if (v < BRIGHT) continue
        n++
        if (s > 0.15 && h >= 300) m++
      }
    }
    if (n && m / n >= PINK) pink++
  }
  return peaks.length ? pink / peaks.length : 0
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
  let level = magenta >= PINK ? 4 : 0
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
  const refined =
    level === 1
      ? purple >= SURE.purple
      : level === 2
        ? chroma >= SURE.chroma && gold >= SURE.gold
        : level === 3
          ? red >= SURE.red
          : level === 4 && pinkStarShare(shot, band, peaks) >= SURE.pinkStars
  if (stars <= SHORT_ROW) return { level: 0, stars, family, sure: !refined }
  return { level, stars, family, sure: level === 0 ? magenta < SURE.r0Pink : refined }
}
