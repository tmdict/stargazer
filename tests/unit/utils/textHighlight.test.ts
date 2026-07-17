import { describe, expect, it } from 'vitest'

import { highlightSkillText, splitHighlightToken } from '@/utils/textHighlight'

describe('splitHighlightToken', () => {
  it('splits a keyword token into label and key', () => {
    expect(splitHighlightToken('reduce the max HP|hpCut')).toEqual({
      label: 'reduce the max HP',
      key: 'hpCut',
    })
  })

  it('treats a pipeless token as a plain label', () => {
    expect(splitHighlightToken('240%')).toEqual({ label: '240%' })
  })

  it('splits on the last pipe, keeping earlier pipes in the label', () => {
    expect(splitHighlightToken('a|b|frontest')).toEqual({ label: 'a|b', key: 'frontest' })
  })

  it('rejects a trailing segment that is not a key shape', () => {
    expect(splitHighlightToken('50%|60%')).toEqual({ label: '50%|60%' })
  })
})

describe('highlightSkillText', () => {
  it('renders value tokens as highlight spans', () => {
    expect(highlightSkillText('deals [[240%]] damage')).toBe(
      'deals <span class="skill-highlight">240%</span> damage',
    )
  })

  it('renders keyword tokens as focusable data-kw spans with the label only', () => {
    expect(highlightSkillText('the [[frontmost|frontest]] enemy')).toBe(
      'the <span class="skill-keyword" data-kw="frontest" role="button" tabindex="0">frontmost</span> enemy',
    )
  })

  it('renders stat tags as labeled pills', () => {
    expect(highlightSkillText('<ATK> and <MR>')).toBe(
      '<span class="skill-stat-tag skill-stat-atk">ATK</span> and ' +
        '<span class="skill-stat-tag skill-stat-mr">Magic Resist</span>',
    )
  })
})
