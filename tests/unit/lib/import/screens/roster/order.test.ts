import { describe, expect, it } from 'vitest'

import { withCrest } from '@/lib/import/card/frames'
import type { CrestReading, HeroReading, RefinementReading } from '@/lib/import/card/types'
import { settleByOrder, type CardEvidence } from '@/lib/import/screens/roster/order'
import type { RosterSlot } from '@/lib/import/screens/roster/types'
import { createImage } from '../../../../fixtures/image'

const stars = (level: number, sure = true): RefinementReading => ({
  level,
  full: true,
  family: 'white',
  sure,
})

const reading = (paragon: number, sure: boolean, refinement = stars(1)): HeroReading => ({
  candidates: [{ characterId: 1, score: 0.9, learned: false, costume: false }],
  recognised: true,
  margin: 0.2,
  sure: true,
  box: { x: 0, y: 0, w: 1, h: 1 },
  card: createImage(1, 1),
  descriptor: new Float32Array(1),
  paragon: { level: paragon, score: 0.7, runnerUp: 0.69, sure },
  refinement,
})

// A slot from a token: P0 to P4 a card sure of its level, B one sure below S+, M one
// in doubt of its family but sure of P0, R0, ? an S+ card in doubt of its level, ?? a
// card in doubt of its family, - an empty slot.
const slot = (token: string, row: number, col: number): RosterSlot => {
  const at = { row, col, hands: false, box: { x: 0, y: 0, w: 1, h: 1 }, inView: 1 }
  if (token === '-') return { ...at, kind: 'empty', frame: null, cell: null }
  const [frame, cell] =
    token === 'B'
      ? [{ family: 'below', sure: true } as const, reading(0, true, stars(0))]
      : token === 'M'
        ? [{ family: 'paragon', sure: false } as const, reading(0, true, stars(0))]
        : token === '??'
          ? [{ family: 'paragon', sure: false } as const, reading(2, false, stars(1, false))]
          : token === '?'
            ? [{ family: 'paragon', sure: true } as const, reading(2, false)]
            : [{ family: 'paragon', sure: true } as const, reading(Number(token[1]), true)]
  return { ...at, kind: 'card', frame, cell }
}

const grid = (...rows: string[][]): RosterSlot[] =>
  rows.flatMap((tokens, row) => tokens.map((token, col) => slot(token, row, col)))

// The frame match's scores by level: P0 best, P2 well ahead of P1 and P3.
const LEVELS = [0.8, 0.6, 0.7, 0.62, 0.5]

const settle = (
  slots: RosterSlot[],
  seen: Partial<CardEvidence> & { at?: number } = {},
): RosterSlot[] => {
  const evidence = new Map<number, CardEvidence>()
  slots.forEach((s, i) => {
    if (!s.cell) return
    const own = seen.at === undefined || seen.at === i
    evidence.set(i, {
      stars: own && seen.stars ? seen.stars : stars(1),
      levels: own && seen.levels ? seen.levels : LEVELS,
      crest: own && seen.crest ? seen.crest : null,
    })
  })
  return settleByOrder(slots, evidence)
}

// A card's levels as "P2 R1", with ? on each one in doubt.
const levelsOf = (s: RosterSlot): string => {
  const { paragon, refinement } = s.cell!
  return `P${paragon.level}${paragon.sure ? '' : '?'} R${refinement.level}${refinement.sure ? '' : '?'}`
}

describe('settleByOrder', () => {
  it('gives a card in doubt the level the sure cards around it leave, with its own stars', () => {
    expect(levelsOf(settle(grid(['P3', '?', 'P3', 'P1']))[1]!)).toBe('P3 R1')
    // In doubt of its family too: between S+ cards it is S+.
    expect(levelsOf(settle(grid(['P0', '??', 'P0']))[1]!)).toBe('P0 R1')
  })

  it('picks within the levels left by the frame match and crest, or the one left', () => {
    const between = grid(['P3', '?', 'P1'])
    const crest = (level: number, sure = true): CrestReading => ({ level, sure })
    expect(levelsOf(settle(between, { crest: crest(2, false) })[1]!)).toBe('P2 R1')
    const close = [0.8, 0.6, 0.7, 0.69, 0.5]
    expect(levelsOf(settle(between, { levels: close, crest: crest(2, false) })[1]!)).toBe('P2? R1')
    expect(levelsOf(settle(between, { levels: close, crest: crest(3) })[1]!)).toBe('P3 R1')
    expect(levelsOf(settle(between, { crest: crest(4) })[1]!)).toBe('P2? R1')
    // Its crest hidden, a card takes a level only when one is left.
    expect(levelsOf(settle(between)[1]!)).toBe('P2? R1')
  })

  it('reads no order across a row left short, nor in a group out of order', () => {
    const broken = grid(['P1', '-', '-', '-', '-', '-'], ['?', 'P1'])
    expect(levelsOf(settle(broken)[6]!)).toBe('P2? R1')
    expect(levelsOf(settle(grid(['P3', '?', 'P3', 'P4']))[1]!)).toBe('P2? R1')
    // A card sure of its S+ frame cannot follow one below S+, so it stays in doubt.
    expect(levelsOf(settle(grid(['B', '?']))[1]!)).toBe('P2? R1')
  })

  it('makes a card after one sure below S+ P0, R0', () => {
    expect(levelsOf(settle(grid(['B', '??']))[1]!)).toBe('P0 R0')
  })

  it('settles a frame match and crest that disagree only where the order rules one out', () => {
    // A clear P0 match against a crest naming P2, as withCrest leaves it.
    const conflict = (crest: CrestReading): RosterSlot => {
      const s = slot('?', 0, 0)
      const cell = { ...s.cell!, paragon: { level: 0, score: 0.8, runnerUp: 0.7, sure: false } }
      return { ...s, cell: withCrest(cell, s.frame!, crest, LEVELS) }
    }
    const sure = { level: 2, sure: true }
    const unsure = { level: 2, sure: false }
    expect(levelsOf(settle([conflict(sure)], { crest: sure })[0]!)).toBe('P0? R1')
    expect(levelsOf(settle([conflict(unsure)], { crest: unsure })[0]!)).toBe('P0? R1')
    const after = [conflict(sure), slot('P2', 0, 1)]
    expect(levelsOf(settle(after, { at: 0, crest: sure })[0]!)).toBe('P2 R1')
  })

  it('takes a card that is S+ or below only as P0 or lower', () => {
    // Neither S+ for the card before it nor a level above P0 for the card after.
    expect(levelsOf(settle(grid(['??', 'M']))[0]!)).toBe('P2? R1?')
    expect(levelsOf(settle(grid(['M', '??']), { at: 1, stars: stars(0) })[1]!)).toBe('P0 R0')
    expect(levelsOf(settle(grid(['M', '??']))[1]!)).toBe('P2? R1?')
  })
})
