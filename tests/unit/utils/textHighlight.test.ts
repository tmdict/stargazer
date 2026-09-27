import { describe, expect, it } from 'vitest'

import { highlightSkillText, splitHighlightToken } from '@/utils/textHighlight'

describe('splitHighlightToken', () => {
  it('splits on the last pipe, keeping earlier pipes in the label', () => {
    expect(splitHighlightToken('a|b|frontest')).toEqual({ label: 'a|b', key: 'frontest' })
  })

  it('rejects a trailing segment that is not a key shape', () => {
    expect(splitHighlightToken('50%|60%')).toEqual({ label: '50%|60%' })
  })
})

describe('highlightSkillText', () => {
  it('renders keyword tokens as focusable data-kw spans with the label only', () => {
    expect(highlightSkillText('the [[frontmost|frontest]] enemy')).toBe(
      'the <span class="skill-keyword" data-kw="frontest" role="button" tabindex="0">frontmost</span> enemy',
    )
  })
})
