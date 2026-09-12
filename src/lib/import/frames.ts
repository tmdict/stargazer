/* Portrait frames: the six reference images (P0 to P4, plus the winged P4)
 * matched by alpha-masked correlation. A frame match does two jobs: it names
 * the paragon level and it pins the card's exact box, which every other
 * per-card region is measured from. The column anchor scores all five rows
 * together, because a single frame (the plain brown P0 above all) correlates
 * with orange UI regions about as well as with a real card. */

import { cropResize, maskedNcc } from './image'
import { ANCHOR_SEARCH, CARD_PITCH, CARD_ROWS, CARD_SEARCH } from './layout'
import type { FrameRef, Rect, RgbaImage } from './types'

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
  ox: number
  oy: number
  // Mean of the five rows' best frame scores.
  mean: number
}

/* Where the five-card column of a panel actually sits: the offset from the
 * nominal column whose rows sum to the best frame matches. */
export function findPanelAnchor(
  shot: RgbaImage,
  refs: readonly FrameRef[],
  columnX: number,
  top: number,
): PanelAnchor {
  let best: PanelAnchor = { ox: 0, oy: 0, mean: -1 }
  for (const scale of FRAME_SCALES) {
    const scaled = refs.filter((r) => r.scale === scale)
    for (const oy of range(ANCHOR_SEARCH.oy[0], ANCHOR_SEARCH.oy[1], ANCHOR_SEARCH.step)) {
      for (const ox of range(ANCHOR_SEARCH.ox[0], ANCHOR_SEARCH.ox[1], ANCHOR_SEARCH.step)) {
        let sum = 0
        for (let i = 0; i < CARD_ROWS; i++) {
          const y = Math.round(top + CARD_PITCH * i) + oy
          let rowBest = -1
          for (const ref of scaled) {
            const s = maskedNcc(shot, ref.image, columnX + ox, y)
            if (s > rowBest) rowBest = s
          }
          sum += rowBest
        }
        const mean = sum / CARD_ROWS
        if (mean > best.mean) best = { ox, oy, mean }
      }
    }
  }
  return best
}

export interface CardMatch {
  ref: FrameRef
  score: number
  box: Rect
  // Best score per paragon level (index = level).
  perLevel: number[]
}

/* The best frame at one card position, searched closely around the anchor. */
export function matchCard(
  shot: RgbaImage,
  refs: readonly FrameRef[],
  columnX: number,
  nominalTop: number,
  anchor: PanelAnchor,
): CardMatch {
  let best: CardMatch | null = null
  const perLevel = [-1, -1, -1, -1, -1]
  for (const ref of refs) {
    for (const oy of range(-CARD_SEARCH.oy, CARD_SEARCH.oy, CARD_SEARCH.step)) {
      for (const ox of range(-CARD_SEARCH.ox, CARD_SEARCH.ox, CARD_SEARCH.step)) {
        const x = columnX + anchor.ox + ox
        const y = nominalTop + anchor.oy + oy
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
