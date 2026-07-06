import { describe, expect, it } from 'vitest'

import { renderRichText } from '@/utils/searchHighlight'

describe('renderRichText', () => {
  it('splits tokens into styled pieces', () => {
    expect(renderRichText('deals [[240%]] <ATK> damage', '')).toEqual([
      { text: 'deals ', kind: 'plain', marked: false },
      { text: '240%', kind: 'value', marked: false },
      { text: ' ', kind: 'plain', marked: false },
      { text: 'ATK', kind: 'stat', tag: 'atk', marked: false },
      { text: ' damage', kind: 'plain', marked: false },
    ])
  })

  it('marks the case-insensitive match inside a token', () => {
    const pieces = renderRichText('deals [[240%]] damage', 'DEALS 240')
    expect(pieces).toEqual([
      { text: 'deals ', kind: 'plain', marked: true },
      { text: '240', kind: 'value', marked: true },
      { text: '%', kind: 'value', marked: false },
      { text: ' damage', kind: 'plain', marked: false },
    ])
  })

  it('marks a stat chip whole on any overlap', () => {
    const pieces = renderRichText('<ATK> up', 'atk up')
    expect(pieces).toEqual([
      { text: 'ATK', kind: 'stat', tag: 'atk', marked: true },
      { text: ' up', kind: 'plain', marked: true },
    ])
  })

  it('renders unmarked when the query is absent', () => {
    const pieces = renderRichText('restores [[300]] HP', 'nothing')
    expect(pieces.every((p) => !p.marked)).toBe(true)
  })

  it('labels unknown stat tags with the raw tag', () => {
    expect(renderRichText('<FOO> boost', '')[0]).toEqual({
      text: 'FOO',
      kind: 'stat',
      tag: 'foo',
      marked: false,
    })
  })
})
