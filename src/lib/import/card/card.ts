/* A hero card read: its frame pins the card's box and names the paragon level,
 * the face inside it is ranked against the hero table, and the star row above
 * the face gives the refinement. Each card is read on its own, then the cards
 * a screen shows together are settled against each other. */

import { cropResize } from '../core/image'
import type { Rect, RgbaImage } from '../core/types'
import { matchCard, paragonFromMatch } from './frames'
import { assignUnique, heroDescriptor, rankHeroes, type Rivals } from './heroes'
import { readStars } from './stars'
import type { CardReferences, HeroCandidate, HeroIdentity, HeroReading } from './types'

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
      refinement: readStars(shot, match.box),
    },
    ranking: trusted ? rankHeroes(refs.heroes, alignments) : [],
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
): HeroReading[] => settleCards(seeds.map((seed) => readCard(shot, refs, seed, trusted)))
