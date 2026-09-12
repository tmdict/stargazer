/* Portrait frames: the six reference images (P0 to P4, plus the winged P4)
 * matched by alpha-masked correlation. A frame match does two jobs: it names
 * the paragon level and it pins the card's exact box, which every other
 * per-card region is measured from. The column anchor scores all five rows
 * together, because a single frame (the plain brown P0 above all) correlates
 * with orange UI regions about as well as with a real card. */

import { cropResize, maskedNcc } from './image'
import {
  ANCHOR_FLOOR,
  ANCHOR_SEARCH,
  CARD_PITCH,
  CARD_PITCH_RANGE,
  CARD_ROWS,
  CARD_SEARCH,
  COLUMN_SCAN,
  PANEL_GAP_RANGE,
  SUMMARY_BAR,
} from './layout'
import { resultHue } from './strip'
import type { FrameRef, Rect, RgbaImage } from './types'

// A pitch step either side of the given one is tried at the anchor; a small
// gain is asked for, since a wrong pitch that happens to score a hair better
// on one shot would move the lower rows off their frames.
const PITCH_STEP = 2
const PITCH_GAIN = 0.01

// Reference image order: p0, p1, p2, p3, p4, p4-crown.
export const FRAME_NAMES = ['p0', 'p1', 'p2', 'p3', 'p4', 'p4-crown'] as const
const FRAME_LEVELS = [0, 1, 2, 3, 4, 4] as const
export const FRAME_SOURCE_WIDTH = 280
export const FRAME_SCALES = [0.25, 0.265, 0.28] as const

// Amber when the score is low or the runner-up family is close: fitted on the
// graded samples, where it flags exactly the misread cards.
const SURE_SCORE = 0.65
const SURE_FLOOR = 0.5
const SURE_GAP = 0.05

export function prepareFrameRefs(images: readonly RgbaImage[]): FrameRef[] {
  const refs: FrameRef[] = []
  images.forEach((image, i) => {
    for (const scale of FRAME_SCALES) {
      const w = Math.round(image.width * scale)
      const h = Math.round(image.height * scale)
      refs.push({
        level: FRAME_LEVELS[i] ?? 0,
        scale,
        image: cropResize(image, { x: 0, y: 0, w: image.width, h: image.height }, w, h),
      })
    }
  })
  return refs
}

const range = (from: number, to: number, step: number): number[] => {
  const out: number[] = []
  for (let v = from; v <= to; v += step) out.push(v)
  return out
}

export interface PanelAnchor {
  // The first card's top-left corner and the row pitch.
  x: number
  y: number
  pitch: number
  // Mean of the five rows' best frame scores.
  mean: number
}

// The comb: the five rows scored together at one column position.
const combMean = (
  shot: RgbaImage,
  refs: readonly FrameRef[],
  x: number,
  top: number,
  pitch: number,
): number => {
  let sum = 0
  for (let i = 0; i < CARD_ROWS; i++) {
    const y = Math.round(top + pitch * i)
    let rowBest = -1
    for (const ref of refs) {
      const s = maskedNcc(shot, ref.image, x, y)
      if (s > rowBest) rowBest = s
    }
    sum += rowBest
  }
  return sum / CARD_ROWS
}

/* Where the five-card column of a panel actually sits: the position near the
 * nominal one whose rows sum to the best frame matches, at the given pitch
 * or a step either side of it when that lines the rows up clearly better. */
export function findPanelAnchor(
  shot: RgbaImage,
  refs: readonly FrameRef[],
  columnX: number,
  top: number,
  pitch: number = CARD_PITCH,
): PanelAnchor {
  let best: PanelAnchor = { x: columnX, y: top, pitch, mean: -1 }
  for (const scale of FRAME_SCALES) {
    const scaled = refs.filter((r) => r.scale === scale)
    for (const oy of range(ANCHOR_SEARCH.oy[0], ANCHOR_SEARCH.oy[1], ANCHOR_SEARCH.step)) {
      for (const ox of range(ANCHOR_SEARCH.ox[0], ANCHOR_SEARCH.ox[1], ANCHOR_SEARCH.step)) {
        const mean = combMean(shot, scaled, columnX + ox, top + oy, pitch)
        if (mean > best.mean) best = { x: columnX + ox, y: top + oy, pitch, mean }
      }
    }
  }
  for (const candidate of [pitch - PITCH_STEP, pitch + PITCH_STEP]) {
    const mean = combMean(shot, refs, best.x, best.y, candidate)
    if (mean > best.mean + PITCH_GAIN) best = { ...best, pitch: candidate, mean }
  }
  return best
}

export interface ColumnPair {
  ally: { x: number; y: number }
  enemy: { x: number; y: number }
  pitch: number
}

/* The two columns' nominal positions anywhere in the shot, for a capture
 * that is not cropped to the panel. Every row position gets its best single
 * frame score once; combs of any pitch and pairs of any panel gap are then
 * sums over that profile, so both are searched freely. The tab above the
 * first card matches a frame about as well as a card, so a comb one row too
 * high scores like the real one; the summary bar under the fifth card tells
 * them apart. Null when no pair clears the floor and has its bars. */
export function scanForColumns(
  shot: RgbaImage,
  refs: readonly FrameRef[],
  columnX: number,
): ColumnPair | null {
  const scaled = refs.filter((r) => r.scale === COLUMN_SCAN.scale)
  const { step } = COLUMN_SCAN
  const rows = Math.floor((shot.height - (scaled[0]?.image.height ?? 0)) / step)
  if (rows <= 0) return null
  const profiles = COLUMN_SCAN.ox.map((ox) => {
    const raw = new Float32Array(rows)
    for (let i = 0; i < rows; i++) {
      let rowBest = -1
      for (const ref of scaled) {
        const s = maskedNcc(shot, ref.image, columnX + ox, i * step)
        if (s > rowBest) rowBest = s
      }
      raw[i] = rowBest
    }
    // Pooled over a step either side, so a row a little off the comb's
    // pitch still counts.
    const pooled = new Float32Array(rows)
    for (let i = 0; i < rows; i++) {
      pooled[i] = Math.max(raw[i]!, raw[i - 1] ?? -1, raw[i + 1] ?? -1)
    }
    return pooled
  })
  const comb = (profile: Float32Array, i: number, pitch: number): number => {
    let sum = 0
    for (let k = 0; k < CARD_ROWS; k++) {
      const j = Math.round((i * step + pitch * k) / step)
      if (j >= rows) return -1
      sum += profile[j]!
    }
    return sum / CARD_ROWS
  }
  const hasSummaryBar = (x: number, top: number, pitch: number): boolean => {
    const fifth = Math.round(top + pitch * (CARD_ROWS - 1))
    return (
      resultHue(
        shot,
        x + SUMMARY_BAR.dx[0],
        x + SUMMARY_BAR.dx[1],
        fifth + SUMMARY_BAR.dy[0],
        fifth + SUMMARY_BAR.dy[1],
      ) !== null
    )
  }
  const pairs: { ox: number; i: number; gap: number; pitch: number; mean: number }[] = []
  profiles.forEach((profile, oxIndex) => {
    for (const pitch of range(CARD_PITCH_RANGE[0], CARD_PITCH_RANGE[1], 2)) {
      const combs = Array.from({ length: rows }, (_, i) => comb(profile, i, pitch))
      for (let i = 0; i < rows; i++) {
        if (combs[i]! < ANCHOR_FLOOR) continue
        for (let gap = PANEL_GAP_RANGE[0]; gap <= PANEL_GAP_RANGE[1]; gap += step) {
          const j = i + gap / step
          if (j >= rows || combs[j]! < ANCHOR_FLOOR) continue
          pairs.push({ ox: oxIndex, i, gap, pitch, mean: (combs[i]! + combs[j]!) / 2 })
        }
      }
    }
  })
  pairs.sort((a, b) => b.mean - a.mean)
  for (const pair of pairs.slice(0, 500)) {
    const x = columnX + COLUMN_SCAN.ox[pair.ox]!
    const allyY = pair.i * step
    const enemyY = allyY + pair.gap
    if (hasSummaryBar(x, allyY, pair.pitch) && hasSummaryBar(x, enemyY, pair.pitch)) {
      return { ally: { x, y: allyY }, enemy: { x, y: enemyY }, pitch: pair.pitch }
    }
  }
  return null
}

export interface CardMatch {
  ref: FrameRef
  score: number
  box: Rect
  // Best score per paragon level (index = level).
  perLevel: number[]
}

/* The best frame at one card row, searched closely around the anchor. */
export function matchCard(
  shot: RgbaImage,
  refs: readonly FrameRef[],
  anchor: PanelAnchor,
  row: number,
): CardMatch {
  let best: CardMatch | null = null
  const perLevel = [-1, -1, -1, -1, -1]
  const top = Math.round(anchor.y + anchor.pitch * row)
  for (const ref of refs) {
    for (const oy of range(-CARD_SEARCH.oy, CARD_SEARCH.oy, CARD_SEARCH.step)) {
      for (const ox of range(-CARD_SEARCH.ox, CARD_SEARCH.ox, CARD_SEARCH.step)) {
        const x = anchor.x + ox
        const y = top + oy
        const score = maskedNcc(shot, ref.image, x, y)
        if (score > perLevel[ref.level]!) perLevel[ref.level] = score
        if (!best || score > best.score) {
          best = { ref, score, box: { x, y, w: ref.image.width, h: ref.image.height }, perLevel }
        }
      }
    }
  }
  return best!
}

export function paragonFromMatch(match: CardMatch): {
  level: number
  score: number
  runnerUp: number
  sure: boolean
} {
  const level = match.ref.level
  const runnerUp = Math.max(...match.perLevel.filter((_, i) => i !== level))
  const sure =
    match.score >= SURE_FLOOR && (match.score >= SURE_SCORE || runnerUp < match.score - SURE_GAP)
  return { level, score: match.score, runnerUp, sure }
}
