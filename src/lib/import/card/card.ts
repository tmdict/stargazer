/* A hero card read: its frame pins the card's box and names the paragon level,
 * the face inside it is ranked against the hero table, and the star row above
 * the face gives the refinement. Each card is read on its own, then the cards
 * a screen shows together are settled against each other. */

import { cropResize, maskedNcc, resample } from '../core/image'
import type { Rect, RgbaImage } from '../core/types'
import {
  CARD_ASPECT,
  FRAME_SCALES,
  matchCard,
  paragonFromMatch,
  READ_WIDTH,
  readCrest,
} from './frames'
import { assignUnique, heroDescriptor, rankHeroes, type Rivals } from './heroes'
import { readStars, type StarRow } from './stars'
import type { CardReferences, Crest, HeroCandidate, HeroIdentity, HeroReading } from './types'

// The face inside a matched frame: fractions of the frame box. Only the upper
// part of the art is used, since the badges and the frame's white swirl
// cover the rest.
export const ART_BOX = { x: 0.23, y: 0.2, w: 0.69, aspect: 36 / 48 } as const

// Small offsets of the face crop, centre first, absorbing the frame match's
// residual error.
const ALIGNMENTS: readonly [number, number][] = [
  [0, 0],
  [-2, -3],
  [0, -3],
  [2, -3],
  [-2, 0],
  [2, 0],
  [-2, 3],
  [0, 3],
  [2, 3],
]

export const artBoxOf = (box: Rect): Rect => {
  const w = Math.round(box.w * ART_BOX.w)
  return {
    x: Math.round(box.x + box.w * ART_BOX.x),
    y: Math.round(box.y + box.h * ART_BOX.y),
    w,
    h: Math.round(w * ART_BOX.aspect),
  }
}

// A card read on its own, before the cards beside it settle who is who.
export interface CardRead {
  cell: Omit<HeroReading, keyof HeroIdentity>
  // The hero table's best matches for the face, best first; none without a
  // trusted placement.
  ranking: HeroCandidate[]
  // The frame match's best score at each paragon level (index = level).
  levels: number[]
  crest: Crest | null
}

/* One card from where it is expected (its frame's top-left): its frame pins
 * its box, and the face, the star row and a crop for the review come from
 * there. Without a trusted placement the box is a guess, and the face is not
 * ranked. */
export const readCard = (
  shot: RgbaImage,
  refs: CardReferences,
  seed: { x: number; y: number },
  trusted: boolean,
  stars: StarRow,
): CardRead => {
  const match = matchCard(shot, refs.frames, seed)
  const art = artBoxOf(match.box)
  const alignments = ALIGNMENTS.map(([dx, dy]) =>
    heroDescriptor(shot, { ...art, x: art.x + dx, y: art.y + dy }),
  )
  const cardRect = {
    x: match.box.x - 3,
    y: match.box.y - 3,
    w: match.box.w + 6,
    h: match.box.h + 6,
  }
  return {
    cell: {
      box: match.box,
      card: cropResize(shot, cardRect, cardRect.w, cardRect.h),
      descriptor: alignments[0]!,
      paragon: paragonFromMatch(match),
      refinement: readStars(shot, match.box, stars),
    },
    ranking: trusted ? rankHeroes(refs.heroes, alignments) : [],
    levels: match.perLevel,
    crest: readCrest(shot, refs.frames, match.box),
  }
}

// Cards shown together field different heroes, so their faces are settled
// against each other (assignUnique).
export const settleCards = (
  cards: readonly CardRead[],
  rivals: Rivals = 'untaken',
): HeroReading[] => {
  const identities = assignUnique(
    cards.map((card) => card.ranking),
    rivals,
  )
  return cards.map((card, i) => ({ ...card.cell, ...identities[i]! }))
}

/* Cards shown together (a side's five, a formation's row), each read from
 * where it is expected and then settled. Without a trusted placement the boxes
 * are guesses, so the cells are offered empty for the picker rather than with a
 * stranger's face. */
export const readCards = (
  shot: RgbaImage,
  refs: CardReferences,
  seeds: readonly { x: number; y: number }[],
  trusted: boolean,
  stars: StarRow,
): HeroReading[] => settleCards(seeds.map((seed) => readCard(shot, refs, seed, trusted, stars)))

// A screen's rough card boxes are off by a few percent; the frames settle the
// template's width among these factors of the boxes' width.
const SCALES = [0.94, 1, 1.06] as const
const SCALE_STEP = 0.03

/* Cards of one size from rough template boxes in the screenshot's pixels, each
 * read on a copy where they meet the frame templates, the box's top-left the
 * seed. The copy's scale is the one at which the frames of the first cards match
 * best. A card whose box starts above `top`, where a header covers it, is read on
 * the copy's rows from there down, so its frame is matched on what shows of it,
 * as one at a shot's edge is. The cards come back in the screenshot's pixels,
 * unsettled. */
export function readCardBoxes(
  img: RgbaImage,
  boxes: readonly Rect[],
  refs: CardReferences,
  stars: StarRow,
  top = 0,
): CardRead[] {
  if (boxes.length === 0) return []
  const margin = 0.3 * boxes[0]!.w
  const x0 = Math.max(0, Math.min(...boxes.map((b) => b.x)) - margin)
  const y0 = Math.max(0, Math.min(...boxes.map((b) => b.y)) - margin)
  const x1 = Math.min(img.width, Math.max(...boxes.map((b) => b.x + b.w)) + margin)
  const y1 = Math.min(img.height, Math.max(...boxes.map((b) => b.y + b.h)) + margin)
  const region = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
  if (region.w < 4 || region.h < 4) return []
  const at = (k: number) => {
    const scaled = resample(img, region, Math.round(region.w * k), Math.round(region.h * k))
    // The template box at this scale, about the box's centre.
    const seeds = boxes.map((b) => ({
      x: Math.round((b.x + b.w / 2 - x0) * k - READ_WIDTH / 2),
      y: Math.round((b.y + b.h / 2 - y0) * k - (READ_WIDTH * CARD_ASPECT) / 2),
    }))
    return { scaled, seeds }
  }
  const middle = refs.frames.filter((r) => Math.abs(r.scale - FRAME_SCALES[1]) < 1e-6)
  // The first cards the header leaves whole, then any.
  const probe = [...boxes.keys()]
    .sort((i, j) => Number(boxes[i]!.y < top) - Number(boxes[j]!.y < top))
    .slice(0, 8)
  // How well the probe's frames match at a factor of the box's width.
  const fit = (factor: number): { factor: number; k: number; score: number } => {
    const k = READ_WIDTH / (boxes[0]!.w * factor)
    const { scaled, seeds } = at(k)
    let sum = 0
    for (const seed of probe.map((i) => seeds[i]!)) {
      let b = -1
      for (let dy = -8; dy <= 8; dy += 2) {
        for (let dx = -6; dx <= 6; dx += 2) {
          for (const r of middle)
            b = Math.max(b, maskedNcc(scaled, r.image, seed.x + dx, seed.y + dy, 3))
        }
      }
      sum += b
    }
    return { factor, k, score: sum / probe.length }
  }
  // Coarse, then a step either side of the best.
  const better = <T extends { score: number }>(a: T, b: T): T => (b.score > a.score ? b : a)
  const coarse = SCALES.map(fit).reduce(better)
  const best = [coarse.factor - SCALE_STEP, coarse.factor + SCALE_STEP]
    .map(fit)
    .reduce(better, coarse)
  const { scaled, seeds } = at(best.k)
  const cut = Math.min(scaled.height, Math.max(0, Math.ceil((top - y0) * best.k)))
  const below =
    cut > 0
      ? cropResize(
          scaled,
          { x: 0, y: cut, w: scaled.width, h: scaled.height - cut },
          scaled.width,
          scaled.height - cut,
        )
      : scaled
  const sx = region.w / scaled.width
  const sy = region.h / scaled.height
  return seeds.map((seed) => {
    const covered = seed.y < cut
    const read = covered
      ? readCard(below, refs, { x: seed.x, y: seed.y - cut }, true, stars)
      : readCard(scaled, refs, seed, true, stars)
    const { x, w, h } = read.cell.box
    const y = read.cell.box.y + (covered ? cut : 0)
    const box = {
      x: Math.round(x0 + x * sx),
      y: Math.round(y0 + y * sy),
      w: Math.round(w * sx),
      h: Math.round(h * sy),
    }
    return { ...read, cell: { ...read.cell, box } }
  })
}
