/* Portrait frames: the six reference images (P0 to P4, plus the winged P4)
 * matched by alpha-masked correlation. A frame match does two jobs: it names
 * the paragon level and it pins the card's exact box, which every other
 * per-card region is measured from. */

import { cropResize, maskedNcc } from '../core/image'
import type { Rect, RgbaImage } from '../core/types'
import type { FrameFamilyReading, FrameRef, HeroReading, ParagonReading } from './types'

export const FRAME_NAMES = ['p0', 'p1', 'p2', 'p3', 'p4', 'p4-crown'] as const
const FRAME_LEVELS = [0, 1, 2, 3, 4, 4] as const
export const FRAME_SCALES = [0.25, 0.265, 0.28] as const
// The frame's height over its width (the templates are 280 x 404).
export const CARD_ASPECT = 404 / 280
// Cards are read on a copy where they are the frame templates' middle width.
export const READ_WIDTH = 280 * FRAME_SCALES[1]

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

// The frame family from the paragon frame match. On labelled roster cards a paragon
// frame matches its template at 0.55 to 0.88 and a card below S+ at 0.22 to 0.56,
// except the winged P4, which scores as low as 0.46 but leads the other levels by
// 0.09 or more, where a card below S+ read as P4 leads by 0.06 or less (bar one at a
// score of 0.36). Between the bounds the family is unsure.
const PARAGON = { score: 0.565, sure: 0.62 } as const
const WINGED = { score: 0.42, lead: 0.08, sureScore: 0.45, sureLead: 0.09 } as const
const BELOW = { sure: 0.5, wingedLead: 0.07 } as const
// A paragon level is sure only when it leads the next level by this much, whatever
// its score: P0, P2 and P3 frames match one another's templates within 0.014 on
// misread roster cards, some at scores the match import takes as sure.
const LEVEL_LEAD = 0.02

export const frameFamily = ({ level, score, runnerUp }: ParagonReading): FrameFamilyReading => {
  const lead = score - runnerUp
  const winged = level === 4 && lead >= WINGED.lead && score >= WINGED.score
  if (score >= PARAGON.score || winged) {
    const sure =
      score >= PARAGON.sure || (level === 4 && lead >= WINGED.sureLead && score >= WINGED.sureScore)
    return { family: 'paragon', sure }
  }
  return {
    family: 'below',
    sure: score <= BELOW.sure && !(level === 4 && lead >= BELOW.wingedLead),
  }
}

/* A card's levels as its family has them: P0, R0 by rule below S+, and in doubt
 * whenever the family is. */
export const withFamily = (cell: HeroReading, frame: FrameFamilyReading): HeroReading => {
  if (frame.family === 'below') {
    return {
      ...cell,
      paragon: { ...cell.paragon, level: 0, sure: frame.sure },
      refinement: { ...cell.refinement, level: 0, sure: frame.sure },
    }
  }
  const lead = cell.paragon.score - cell.paragon.runnerUp
  return {
    ...cell,
    paragon: { ...cell.paragon, sure: frame.sure && lead >= LEVEL_LEAD },
    refinement: { ...cell.refinement, sure: frame.sure && cell.refinement.sure },
  }
}
