import { describe, expect, it } from 'vitest'

import { cleanSkillText, renderRichText } from '@/utils/searchHighlight'

describe('cleanSkillText', () => {
  it('collapses value and keyword tokens to their visible text', () => {
    expect(cleanSkillText('deals [[240%]]<ATK> to [[2]] [[frontmost|frontest]] enemies')).toBe(
      'deals 240% to 2 frontmost enemies',
    )
  })
})

describe('renderRichText', () => {
  it('renders a keyword token as its label, searchable like the corpus', () => {
    expect(renderRichText('the [[weakest|weakest]] ally', 'weakest ally')).toEqual([
      { text: 'the ', kind: 'plain', marked: false },
      { text: 'weakest', kind: 'value', marked: true },
      { text: ' ally', kind: 'plain', marked: true },
    ])
  })

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

  it('skips chip labels when matching, like the search corpus does', () => {
    const pieces = renderRichText('raises <ATK> by [[5]], ATK up', 'atk')
    expect(pieces).toEqual([
      { text: 'raises ', kind: 'plain', marked: false },
      { text: 'ATK', kind: 'stat', tag: 'atk', marked: false },
      { text: ' by ', kind: 'plain', marked: false },
      { text: '5', kind: 'value', marked: false },
      { text: ', ', kind: 'plain', marked: false },
      { text: 'ATK', kind: 'plain', marked: true },
      { text: ' up', kind: 'plain', marked: false },
    ])
  })

  it('marks a phrase spanning an interleaved chip', () => {
    expect(renderRichText('[[150%]]<ATK> damage', '150% damage')).toEqual([
      { text: '150%', kind: 'value', marked: true },
      { text: 'ATK', kind: 'stat', tag: 'atk', marked: false },
      { text: ' damage', kind: 'plain', marked: true },
    ])
  })

  it('collapses whitespace runs so corpus matches still mark', () => {
    expect(renderRichText('summons Elona. \nActive. Bryon', 'elona. active')).toEqual([
      { text: 'summons ', kind: 'plain', marked: false },
      { text: 'Elona. Active', kind: 'plain', marked: true },
      { text: '. Bryon', kind: 'plain', marked: false },
    ])
  })

  it('keeps mark offsets exact after length-changing case folds', () => {
    expect(renderRichText('İlk vuruş kalıcı hasar', 'kalıcı')).toEqual([
      { text: 'İlk vuruş ', kind: 'plain', marked: false },
      { text: 'kalıcı', kind: 'plain', marked: true },
      { text: ' hasar', kind: 'plain', marked: false },
    ])
  })

  it('renders unmarked when the query has no match', () => {
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
