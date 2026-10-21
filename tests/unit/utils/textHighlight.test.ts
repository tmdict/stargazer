import { describe, expect, it } from 'vitest'

import { splitHighlightToken } from '@/utils/textHighlight'

describe('splitHighlightToken', () => {
  it('splits on the last pipe, keeping earlier pipes in the label', () => {
    expect(splitHighlightToken('a|b|frontmost')).toEqual({ label: 'a|b', key: 'frontmost' })
  })

  it('rejects a trailing segment that is not a key shape', () => {
    expect(splitHighlightToken('50%|60%')).toEqual({ label: '50%|60%' })
  })
})
