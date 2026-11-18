import { describe, expect, it } from 'vitest'

import { DUEL_ITEM_ID_MAX } from '@/lib/hd/board'
import { decodeDuelBoard, encodeDuelBoard, type DuelBoardState } from '@/lib/hd/boardLink'
import { BitWriter, bytesToUrlSafe } from '@/lib/teams/bitCodec'
import { Team } from '@/lib/types/team'

const EMPTY: DuelBoardState = {
  d: 0,
  map: 'arena1',
  units: [],
  artifacts: { ally: null, enemy: null },
}

// Map III; a Legendary hero with a piece, two Trial copies sharing a piece (one
// Supreme), a Mythic enemy; an ally artifact at level 3; skills shown on a
// tilted board.
const EXAMPLE: DuelBoardState = {
  d: 6,
  map: 'arena3',
  units: [
    { hexId: 4, team: Team.ALLY, heroId: 10, trial: false, tier: 1, equipment: 63 },
    { hexId: 7, team: Team.ALLY, heroId: 39, trial: true, tier: 3, equipment: 12 },
    { hexId: 9, team: Team.ALLY, heroId: 39, trial: true, tier: 0, equipment: 12 },
    { hexId: 39, team: Team.ENEMY, heroId: 84, trial: false, tier: 2, equipment: 0 },
  ],
  artifacts: { ally: { id: 31, level: 3 }, enemy: null },
}

const FULL: DuelBoardState = {
  d: 31,
  map: 'arena5',
  units: [1, 2, 3, 4, 5, 41, 42, 43, 44, 45].map((hexId) => ({
    hexId,
    team: hexId < 20 ? Team.ALLY : Team.ENEMY,
    heroId: 132,
    trial: true,
    tier: 3,
    equipment: 113,
  })),
  artifacts: { ally: { id: 53, level: 3 }, enemy: { id: 52, level: 1 } },
}

// A text laid out by hand, field by field, for the refusals the encoder never writes.
const handWritten = (fields: readonly [value: number, bits: number][]): string => {
  const writer = new BitWriter()
  for (const [value, bits] of fields) writer.writeBits(value, bits)
  return bytesToUrlSafe(writer.getBytes())
}

const HEADER = (parts: number, d = 0, map = 1): [number, number][] => [
  [d, 8],
  [map, 6],
  [parts, 8],
]

const UNIT = (
  over: Partial<Record<'hex' | 'team' | 'hero' | 'trial' | 'tier' | 'piece', number>> = {},
): [number, number][] => [
  [over.hex ?? 4, 6],
  [over.team ?? 0, 1],
  [over.hero ?? 10, 14],
  [over.trial ?? 0, 1],
  [over.tier ?? 0, 2],
  [over.piece ?? 0, 8],
]

// 58 bits in 11 characters, so the last character ends in spare bits.
const ONE_UNIT = handWritten([...HEADER(1), [1, 4], ...UNIT()])

describe('Honor Duel board link', () => {
  it('writes the fixed example texts', () => {
    expect(encodeDuelBoard(EMPTY)).toBe('AAEA')
    expect(encodeDuelBoard(EXAMPLE)).toBe('BsMAERQA_RxOgDMkToAwnKkAAnwMAA')
    expect(encodeDuelBoard(FULL)).toHaveLength(62)
  })

  it.each([
    ['an empty board', EMPTY],
    ['the example board', EXAMPLE],
    ['two full teams', FULL],
    ['artifacts alone', { ...EMPTY, artifacts: { ally: null, enemy: { id: 7, level: 2 } } }],
  ])('reads back %s', (_, board) => {
    expect(decodeDuelBoard(encodeDuelBoard(board))).toEqual(board)
  })

  it('reads a text it wrote by hand as the encoder would', () => {
    expect(ONE_UNIT.endsWith('A')).toBe(true)
    expect(decodeDuelBoard(ONE_UNIT)).toEqual({
      ...EMPTY,
      units: [{ hexId: 4, team: Team.ALLY, heroId: 10, trial: false, tier: 0, equipment: 0 }],
    })
  })

  it.each([
    ['empty text', ''],
    ['a character outside the alphabet', 'AAQ!'],
    ['a text cut short', 'BsMAERQA_RxOgDMkToAwnK'],
    ['an extra character', 'AAEAA'],
    ['spare bits set in the last character', ONE_UNIT.slice(0, -1) + 'B'],
    ['a spare view switch', handWritten(HEADER(0, 32))],
    ['map number zero', handWritten(HEADER(0, 0, 0))],
    ['a map number no map has', handWritten(HEADER(0, 0, 63))],
    ['a map off the Honor Duel list', handWritten(HEADER(0, 0, 11))],
    ['a spare part', handWritten(HEADER(4))],
    ['a unit count of zero', handWritten([...HEADER(1), [0, 4]])],
    ['tile zero', handWritten([...HEADER(1), [1, 4], ...UNIT({ hex: 0 })])],
    ['a tile past the board', handWritten([...HEADER(1), [1, 4], ...UNIT({ hex: 46 })])],
    ['hero zero', handWritten([...HEADER(1), [1, 4], ...UNIT({ hero: 0 })])],
    ['a placeholder for a hero', handWritten([...HEADER(1), [1, 4], ...UNIT({ hero: 9001 })])],
    ['Supreme on a normal hero', handWritten([...HEADER(1), [1, 4], ...UNIT({ tier: 3 })])],
    [
      'units out of tile order',
      handWritten([...HEADER(1), [2, 4], ...UNIT({ hex: 9 }), ...UNIT({ hex: 4, hero: 11 })]),
    ],
    [
      'two units on one tile',
      handWritten([...HEADER(1), [2, 4], ...UNIT(), ...UNIT({ hero: 11 })]),
    ],
    ['an artifact part with no artifact', handWritten([...HEADER(2), [0, 10], [0, 10]])],
    ['an artifact with no level', handWritten([...HEADER(2), [31, 8], [0, 2], [0, 10]])],
    ['a level with no artifact', handWritten([...HEADER(2), [0, 8], [2, 2], [0, 10]])],
    ['a whole spare byte', handWritten([...HEADER(0), [0, 10]])],
  ])('refuses %s', (_, text) => {
    expect(decodeDuelBoard(text)).toBeNull()
  })

  it('accepts Supreme on a Trial hero', () => {
    const text = handWritten([...HEADER(1), [1, 4], ...UNIT({ trial: 1, tier: 3 })])
    expect(decodeDuelBoard(text)?.units[0]).toMatchObject({ trial: true, tier: 3 })
  })

  it('refuses to write a board its layout cannot hold', () => {
    const unit = EXAMPLE.units[0]!
    expect(() => encodeDuelBoard({ ...EMPTY, map: 'preset-sr2' })).toThrow()
    expect(() => encodeDuelBoard({ ...EMPTY, units: [{ ...unit, tier: 3 }] })).toThrow()
    expect(() =>
      encodeDuelBoard({ ...EMPTY, artifacts: { ally: { id: 31, level: 4 }, enemy: null } }),
    ).toThrow()
  })

  // A piece numbered past the link's item field would be stored as another
  // piece, and an artifact past it would stop the board saving.
  it('has room for every piece and artifact of the mode', () => {
    const ids = [
      import.meta.glob<{ id: number }>('@/data/hd/equipment/*.json', { eager: true }),
      import.meta.glob<{ id: number }>('@/data/hd/artifact/*.json', { eager: true }),
    ].flatMap((files) => Object.values(files).map((file) => file.id))

    expect(ids.length).toBeGreaterThan(0)
    expect(Math.max(...ids)).toBeLessThanOrEqual(DUEL_ITEM_ID_MAX)
  })
})
