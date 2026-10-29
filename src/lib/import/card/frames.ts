/* Portrait frames: the six reference images (P0 to P4, plus the winged P4)
 * matched by alpha-masked correlation. A frame match does two jobs: it names
 * the paragon level and it pins the card's exact box, which every other
 * per-card region is measured from. */

import { cropResize, maskedNcc } from '../core/image'
import type { Rect, RgbaImage } from '../core/types'
import type {
  Crest,
  CrestReading,
  FrameFamilyReading,
  FrameRef,
  HeroReading,
  ParagonReading,
} from './types'

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

// Amber when the score is low or the next level is close: fitted on the graded
// samples. A level is sure only when it also leads the next by LEVEL_LEAD, whatever
// its score: P0, P2 and P3 frames match one another's templates within 0.014 on
// misread cards, some at scores above SURE_SCORE.
const SURE_SCORE = 0.65
const SURE_FLOOR = 0.5
const SURE_GAP = 0.05
export const LEVEL_LEAD = 0.02

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

/* Whether a match screen's frame match places its card well enough to cut the face
 * from, whatever its level. */
export const frameTrusted = ({
  score,
  runnerUp,
}: Pick<ParagonReading, 'score' | 'runnerUp'>): boolean =>
  score >= SURE_FLOOR && (score >= SURE_SCORE || runnerUp < score - SURE_GAP)

export function paragonFromMatch(match: CardMatch): ParagonReading {
  const level = match.ref.level
  const score = match.score
  const runnerUp = Math.max(...match.perLevel.filter((_, i) => i !== level))
  const sure = frameTrusted({ score, runnerUp }) && score - runnerUp >= LEVEL_LEAD
  return { level, score, runnerUp, sure }
}

// The frame family from the paragon frame match. On labelled roster cards a paragon
// frame matches its template at 0.55 to 0.88 and a card below S+ at 0.22 to 0.56,
// except the winged P4, which scores as low as 0.46 but leads the other levels by
// 0.09 or more, where a card below S+ read as P4 leads by 0.06 or less (bar one at a
// score of 0.36). Between the bounds the family is unsure.
const PARAGON = { score: 0.565, sure: 0.62 } as const
const WINGED = { score: 0.42, lead: 0.08, sureScore: 0.45, sureLead: 0.09 } as const
const BELOW = { sure: 0.5, wingedLead: 0.07 } as const

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

// A template pixel is paint from this alpha up.
const PAINT = 200
// Two paints differ by more than this, averaged over the channels.
const REPAINT = 60

const distance = (a: Uint8ClampedArray, i: number, b: Uint8ClampedArray, j: number): number =>
  (Math.abs(a[i]! - b[j]!) + Math.abs(a[i + 1]! - b[j + 1]!) + Math.abs(a[i + 2]! - b[j + 2]!)) / 3

/* The crest of the frame whose template box is `box`: the frame's top half, where
 * the levels differ most. P2 to P4 add a crown the S+ frame has none of, and P1 and
 * P4 paint the bands beside it in colours of their own. The whole-frame match scores
 * a template only where it has paint, so it never counts a crown against S+; the crest
 * looks at those parts alone. Each template pixel is compared with the nearest of the
 * 3 x 3 pixels where it lands, which absorbs the box's last pixel of error. Null when
 * the crest is not all in the shot. */
export function readCrest(shot: RgbaImage, refs: readonly FrameRef[], box: Rect): Crest | null {
  const sized = refs.filter((r) => r.image.width === box.w && r.image.height === box.h)
  const frame = (level: number) => sized.find((r) => r.level === level)?.image
  const plain = frame(0)
  if (!plain) return null
  if (box.x < 1 || box.y < 1 || box.x + box.w + 1 > shot.width) return null
  if (box.y + box.h / 2 + 1 > shot.height) return null
  const near = (t: RgbaImage, i: number, x: number, y: number): number => {
    let best = Infinity
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const si = ((box.y + y + dy) * shot.width + box.x + x + dx) * 4
        best = Math.min(best, distance(shot.data, si, t.data, i))
      }
    }
    return best
  }
  // The mean over the crest's pixels a level paints and S+ leaves bare (its crown),
  // or of how much nearer the level's paint is than S+'s where both paint apart (its tint).
  const mean = (level: number, part: 'crown' | 'tint'): number | null => {
    const t = frame(level)
    if (!t) return null
    let sum = 0
    let n = 0
    for (let y = 0; y < t.height / 2; y++) {
      for (let x = 0; x < t.width; x++) {
        const i = (y * t.width + x) * 4
        if (t.data[i + 3]! < PAINT) continue
        const bare = plain.data[i + 3]! < PAINT
        if (part === 'crown' && bare) sum += near(t, i, x, y)
        else if (part === 'tint' && !bare && distance(t.data, i, plain.data, i) > REPAINT)
          sum += near(t, i, x, y) - near(plain, i, x, y)
        else continue
        n++
      }
    }
    return n ? sum / n : null
  }
  const [p2, p3, p1Tint, p4Tint] = [
    mean(2, 'crown'),
    mean(3, 'crown'),
    mean(1, 'tint'),
    mean(4, 'tint'),
  ]
  if (p2 == null || p3 == null || p1Tint == null || p4Tint == null) return null
  return { p2, p3, p1Tint, p4Tint }
}

// The crest's level, each step sure only when clear of its bound by `margin`. On the
// labelled roster cards, whose crests sit on the cream ground, every card with a sure
// paragon frame reads right and sure: each step clears its bound by 9 or more, but a
// P3 crown, 3.7 or more nearer than P2's. On the match screens' cards the bounds do not
// hold (19 of 872 would read wrong while sure), so only the roster reads the crest.
const CREST = { crown: 25, margin: 3 } as const

export function crestLevel({ p2, p3, p1Tint, p4Tint }: Crest): CrestReading {
  const clear = (v: number) => Math.abs(v) >= CREST.margin
  if (p4Tint < 0) return { level: 4, sure: clear(p4Tint) }
  if (p1Tint < 0) return { level: 1, sure: clear(p4Tint) && clear(p1Tint) }
  const crown = Math.min(p2, p3) - CREST.crown
  const sure = clear(p4Tint) && clear(p1Tint) && clear(crown)
  if (crown >= 0) return { level: 0, sure }
  return { level: p3 < p2 ? 3 : 2, sure: sure && clear(p2 - p3) }
}

/* A paragon reading at another level of the same frame match: that level's score
 * and the best of the others. */
export const atLevel = (
  levels: readonly number[],
  level: number,
  sure: boolean,
): ParagonReading => ({
  level,
  score: levels[level]!,
  runnerUp: Math.max(...levels.filter((_, i) => i !== level)),
  sure,
})

/* A card's levels as its family and its crest have them. Where the crest shows, a
 * level it and the frame match agree on is sure when either is; a sure crest stands
 * over a frame match too close to call, and one that contradicts a clear match leaves
 * the match's level in doubt. A card whose family is in doubt still has sure levels
 * when both families give the same ones: an S+ crest and a sure R0 row are P0, R0
 * either way. */
export const withCrest = (
  cell: HeroReading,
  frame: FrameFamilyReading,
  crest: CrestReading | null,
  levels: readonly number[],
): HeroReading => {
  const read = withFamily(cell, frame)
  if (!crest) return read
  if (!frame.sure) {
    const { refinement } = cell
    const bare = crest.sure && crest.level === 0 && refinement.level === 0 && refinement.sure
    return bare ? { ...read, paragon: atLevel(levels, 0, true), refinement } : read
  }
  if (frame.family === 'below') return read
  const clear = cell.paragon.score - cell.paragon.runnerUp >= LEVEL_LEAD
  if (crest.level === cell.paragon.level) {
    return { ...read, paragon: { ...read.paragon, sure: crest.sure || clear } }
  }
  return crest.sure && !clear
    ? { ...read, paragon: atLevel(levels, crest.level, true) }
    : { ...read, paragon: { ...read.paragon, sure: false } }
}
