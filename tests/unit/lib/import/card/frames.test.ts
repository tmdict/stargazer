import { describe, expect, it } from 'vitest'

import { crestLevel, withCrest } from '@/lib/import/card/frames'
import type { CrestReading, FrameFamilyReading, HeroReading } from '@/lib/import/card/types'
import { createImage } from '../../../fixtures/image'

// A card read at P0, P2 next by `lead`, with a sure star row at `refinement`.
const card = (lead: number, refinement = 1): HeroReading => ({
  candidates: [{ characterId: 1, score: 0.9, learned: false, costume: false }],
  recognised: true,
  margin: 0.2,
  sure: true,
  box: { x: 0, y: 0, w: 1, h: 1 },
  card: createImage(1, 1),
  descriptor: new Float32Array(1),
  paragon: { level: 0, score: 0.7, runnerUp: 0.7 - lead, sure: false },
  refinement: { level: refinement, full: true, family: 'white', sure: true },
})
const levels = (lead: number) => [0.7, 0.4, 0.7 - lead, 0.4, 0.4]

const PARAGON: FrameFamilyReading = { family: 'paragon', sure: true }
const IN_DOUBT: FrameFamilyReading = { family: 'paragon', sure: false }

// A card's levels as "P2 R1", with ? on each one in doubt.
const levelsOf = ({ paragon, refinement }: HeroReading): string =>
  `P${paragon.level}${paragon.sure ? '' : '?'} R${refinement.level}${refinement.sure ? '' : '?'}`

const read = (lead: number, crest: CrestReading, frame = PARAGON, refinement = 1): string =>
  levelsOf(withCrest(card(lead, refinement), frame, crest, levels(lead)))

describe('crestLevel', () => {
  it('takes P4, then P1, then a crown, each step sure only clear of its cut', () => {
    const plain = { p2: 40, p3: 40, p1Tint: 30, p4Tint: 30 }
    expect(crestLevel(plain)).toEqual({ level: 0, sure: true })
    expect(crestLevel({ ...plain, p2: 10, p3: 15 })).toEqual({ level: 2, sure: true })
    expect(crestLevel({ ...plain, p2: 10, p3: 8 })).toEqual({ level: 3, sure: false })
    expect(crestLevel({ ...plain, p2: 23 })).toEqual({ level: 2, sure: false })
    expect(crestLevel({ ...plain, p1Tint: -20, p2: 10 })).toEqual({ level: 1, sure: true })
    expect(crestLevel({ ...plain, p4Tint: -1, p1Tint: -20 })).toEqual({ level: 4, sure: false })
  })
})

describe('withCrest', () => {
  it('settles a level the frame match and crest agree on when either is clear', () => {
    expect(read(0.05, { level: 0, sure: false })).toBe('P0 R1')
    expect(read(0.01, { level: 0, sure: true })).toBe('P0 R1')
    expect(read(0.01, { level: 0, sure: false })).toBe('P0? R1')
  })

  it('takes a sure crest over a close match and leaves any other disagreement in doubt', () => {
    expect(read(0.01, { level: 2, sure: true })).toBe('P2 R1')
    expect(read(0.05, { level: 2, sure: true })).toBe('P0? R1')
    expect(read(0.05, { level: 2, sure: false })).toBe('P0? R1')
  })

  it('gives a card in doubt of its family P0, R0 only when both families would', () => {
    expect(read(0.05, { level: 0, sure: true }, IN_DOUBT, 0)).toBe('P0 R0')
    expect(read(0.05, { level: 1, sure: true }, IN_DOUBT, 0)).toBe('P0? R0?')
    expect(read(0.05, { level: 0, sure: true }, IN_DOUBT, 1)).toBe('P0? R1?')
  })
})
