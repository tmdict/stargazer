/* Portrait frames: the six reference images (P0 to P4, plus the winged P4)
 * matched by alpha-masked correlation. A frame match does two jobs: it names
 * the paragon level and it pins the card's exact box, which every other
 * per-card region is measured from. */

import { cropResize, maskedNcc } from '../core/image'
import type { Rect, RgbaImage } from '../core/types'
import type { FrameRef, ParagonReading } from './types'

export const FRAME_NAMES = ['p0', 'p1', 'p2', 'p3', 'p4', 'p4-crown'] as const
const FRAME_LEVELS = [0, 1, 2, 3, 4, 4] as const
export const FRAME_SCALES = [0.25, 0.265, 0.28] as const

// Offsets tried around where a card is expected. A card can sit up to a
// dozen pixels from where its column's pitch and frame scale put it, and a
// narrower search then settles on a wrong frame size and level.
const CARD_SEARCH = { oy: [-12, 12], ox: [-4, 4], step: 1 } as const

// Amber when the score is low or the runner-up family is close: fitted on the
// graded samples, where it flags exactly the misread cards.
const SURE_SCORE = 0.65
const SURE_FLOOR = 0.5
const SURE_GAP = 0.05

export function prepareFrameRefs(images: readonly RgbaImage[]): FrameRef[] {
  if (images.length === 0) throw new Error('no frame references')
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

export const range = (from: number, to: number, step: number): number[] => {
  const out: number[] = []
  for (let v = from; v <= to; v += step) out.push(v)
  return out
}

export const bestFrameAt = (
  shot: RgbaImage,
  refs: readonly FrameRef[],
  x: number,
  y: number,
): number => {
  let best = -1
  for (const ref of refs) {
    const s = maskedNcc(shot, ref.image, x, y)
    if (s > best) best = s
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

/* The best frame at one card, searched closely around where it is expected
 * (its frame's top-left). */
export function matchCard(
  shot: RgbaImage,
  refs: readonly FrameRef[],
  at: { x: number; y: number },
): CardMatch {
  let best: CardMatch | null = null
  const perLevel = [-1, -1, -1, -1, -1]
  const top = Math.round(at.y)
  for (const ref of refs) {
    for (const oy of range(CARD_SEARCH.oy[0], CARD_SEARCH.oy[1], CARD_SEARCH.step)) {
      for (const ox of range(CARD_SEARCH.ox[0], CARD_SEARCH.ox[1], CARD_SEARCH.step)) {
        const x = at.x + ox
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

export function paragonFromMatch(match: CardMatch): ParagonReading {
  const level = match.ref.level
  const runnerUp = Math.max(...match.perLevel.filter((_, i) => i !== level))
  const sure =
    match.score >= SURE_FLOOR && (match.score >= SURE_SCORE || runnerUp < match.score - SURE_GAP)
  return { level, score: match.score, runnerUp, sure }
}
