import { describe, expect, it } from 'vitest'

import { ATTR_PARAGON, ATTR_REFINEMENT } from '@/lib/characters/attributes'
import { PLACEHOLDER_ID_OFFSET } from '@/lib/characters/placeholder'
import { parseRostersImport, validateRoster, type Roster } from '@/lib/rosters'

const roster = (overrides: Partial<Roster> = {}): Roster => ({
  id: 'a',
  name: 'Main account',
  heroes: { 43: { [ATTR_PARAGON]: 4 } },
  createdAt: 1,
  updatedAt: 2,
  ...overrides,
})

const file = (rosters: unknown[], overrides: Record<string, unknown> = {}): string =>
  JSON.stringify({ app: 'stargazer', kind: 'rosters', exportedAt: 'x', rosters, ...overrides })

describe('validateRoster', () => {
  it('keeps real heroes only and stores their levels canonically', () => {
    const valid = validateRoster({
      id: 'a',
      name: '  Main  ',
      heroes: {
        '43': { [ATTR_REFINEMENT]: 9, [ATTR_PARAGON]: 0, 99: 3 },
        '5': {},
        [PLACEHOLDER_ID_OFFSET]: {},
        '0': {},
        abc: {},
      },
      createdAt: 1,
    })
    expect(valid).toEqual({
      id: 'a',
      name: 'Main',
      // Refinement clamps to its max; default and unknown levels drop.
      heroes: { 5: {}, 43: { [ATTR_REFINEMENT]: 4 } },
      createdAt: 1,
      updatedAt: 0,
    })
    expect(JSON.stringify(valid!.heroes)).toBe('{"5":{},"43":{"2":4}}')
    expect(validateRoster({ ...roster(), name: '  ' })).toBeNull()
    expect(validateRoster({ ...roster(), heroes: [] })).toBeNull()
  })
})

describe('parseRostersImport', () => {
  // The merge rules themselves are pinned in transfer.test.ts; this pins the
  // roster file kind and that the heroes object is the content key.
  it('rejects other files and treats edited heroes as a newer version', () => {
    expect(parseRostersImport(file([roster()], { kind: 'saved-teams' }), [])).toBeNull()

    const edited = roster({ heroes: { 43: {} } })
    const result = parseRostersImport(file([edited]), [roster()])!
    expect(result.conflicts).toBe(1)
    expect(result.accepted.map((r) => r.name)).toEqual(['Main account (imported)'])
  })
})
