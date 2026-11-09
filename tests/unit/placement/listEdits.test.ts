import { describe, expect, it } from 'vitest'

import {
  listDiff,
  listEditsValue,
  listsExportFile,
  listsExportText,
  readListEdits,
  siteChanged,
  type Lists,
} from '@/lib/placement/listEdits'

const SITE: Lists = {
  buff: [1, 2, 3],
  taichi: [{ list: 'buff' }, { line: true }, { every: { class: ['tank', 'mage'] } }],
  tank: [4, 5],
}
const HEROES = new Set([1, 2, 3, 4, 5, 6])

const stored = (lists: Record<string, unknown>): string => JSON.stringify({ lists })

describe('Reading a visitor’s stored lists', () => {
  it('leaves the site’s lists for a value it cannot parse', () => {
    expect(readListEdits('{not json', SITE, HEROES)).toEqual({ lists: SITE, since: {}, notes: [] })
  })

  it('drops a list the site no longer has, one it cannot read and one that breaks a rule', () => {
    const edits = readListEdits(
      stored({
        gone: { entries: [1], site: [1] },
        buff: { entries: [1, { list: 'nowhere' }], site: SITE.buff },
        tank: { entries: [4, { line: true }, 5, { line: true }], site: SITE.tank },
      }),
      SITE,
      HEROES,
    )
    expect(edits.lists).toEqual(SITE)
    expect(edits.since).toEqual({})
    expect(edits.notes).toEqual([
      { kind: 'gone', list: 'gone' },
      { kind: 'unreadable', list: 'buff' },
      { kind: 'broken', list: 'tank' },
    ])
  })

  // A hero the site no longer knows goes without taking the visitor's order
  // of the rest with it.
  it('drops a hero the site does not know and keeps the rest of the list', () => {
    const edits = readListEdits(
      stored({ buff: { entries: [3, 99, 1], site: [1, 2, 3] } }),
      SITE,
      HEROES,
    )
    expect(edits.lists.buff).toEqual([3, 1])
    expect(edits.notes).toEqual([{ kind: 'heroes', list: 'buff', count: 1 }])
  })

  it('takes the site’s list now as the starting point when the value has none', () => {
    const edits = readListEdits(stored({ buff: { entries: [2, 1, 3] } }), SITE, HEROES)
    expect(edits.since.buff).toEqual(SITE.buff)
  })
})

describe('A list the site changed since the visitor did', () => {
  const mine: Lists = { ...SITE, buff: [2, 1, 3] }

  it('is told apart from one the site left alone', () => {
    expect(siteChanged('buff', mine, { buff: [1, 2] }, SITE)).toBe(true)
    expect(siteChanged('buff', mine, { buff: [1, 2, 3] }, SITE)).toBe(false)
  })

  it('stops counting once the visitor’s list matches the site’s', () => {
    expect(siteChanged('buff', SITE, { buff: [1, 2] }, SITE)).toBe(false)
  })
})

describe('What is kept, copied and exported', () => {
  it('keeps nothing when every list matches the site’s, whatever order an every entry names its classes in', () => {
    const lists: Lists = {
      ...SITE,
      taichi: [{ list: 'buff' }, { line: true }, { every: { class: ['mage', 'tank'] } }],
    }
    expect(listEditsValue(lists, {}, SITE)).toBeNull()
  })

  it('keeps each changed list with the site’s version it started from', () => {
    const lists: Lists = { ...SITE, tank: [5, 4] }
    expect(listEditsValue(lists, { tank: [4] }, SITE)).toEqual({
      lists: { tank: { entries: [5, 4], site: [4] } },
    })
  })

  // A list that breaks a rule stays on the page to be fixed, but the engine
  // could not read it, so it is not sent.
  it('exports the changed lists the engine can read, entries only, as text that reads back the same', () => {
    const lists: Lists = {
      ...SITE,
      buff: [3, 1],
      tank: [4, { line: true }, 5, { line: true }],
      taichi: [{ list: 'buff' }, 6, { line: true }, { every: { class: ['tank', 'mage'] } }],
    }
    const file = listsExportFile(lists, SITE, '2026-11-08T10:00:00.000Z')
    expect(file).toEqual({
      app: 'stargazer',
      kind: 'placement-lists',
      exportedAt: '2026-11-08T10:00:00.000Z',
      lists: {
        buff: [3, 1],
        taichi: [{ list: 'buff' }, 6, { line: true }, { every: { class: ['tank', 'mage'] } }],
      },
    })
    expect(JSON.parse(listsExportText(file))).toEqual(file)
  })
})

describe('A list against the site’s', () => {
  // Only the fewest entries count as moved; the rest keep the site's order.
  it('names what came in, what went and what moved', () => {
    const diff = listDiff([1, 2, 3, 4], [2, 3, 1, 6])
    expect([...diff.added]).toEqual(['6'])
    expect(diff.removed).toEqual(['4'])
    expect([...diff.moved]).toEqual([['1', 1]])
  })
})
