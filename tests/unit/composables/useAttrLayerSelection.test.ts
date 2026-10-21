import { beforeEach, describe, expect, it } from 'vitest'

import { useAttrLayerSelection } from '@/composables/useAttrLayerSelection'
import { ATTR_PARAGON, ATTR_REFINEMENT } from '@/lib/characters/attributes'

const BOTH = [ATTR_PARAGON, ATTR_REFINEMENT]

describe('useAttrLayerSelection', () => {
  // The choice is one module-level value, so it outlives a test.
  beforeEach(() => {
    useAttrLayerSelection().select(ATTR_PARAGON)
  })

  it('ALL edits every visible layer', () => {
    const { select, effectiveLayers, litChoice } = useAttrLayerSelection()
    select('all')
    expect(effectiveLayers(BOTH)).toEqual(BOTH)
    expect(litChoice(BOTH)).toBe('all')
    select(ATTR_REFINEMENT)
    expect(effectiveLayers(BOTH)).toEqual([ATTR_REFINEMENT])
  })

  it('edits only visible layers, falling back to visible when the choice is hidden', () => {
    const { select, effectiveLayers, litChoice } = useAttrLayerSelection()
    select('all')
    expect(effectiveLayers([ATTR_REFINEMENT])).toEqual([ATTR_REFINEMENT])
    expect(effectiveLayers([])).toEqual([])
    expect(litChoice([])).toBeNull()
    // The chosen layer's badges hidden: the visible layer acts as chosen instead
    // of taps silently editing an invisible value, and the lit chip follows.
    select(ATTR_PARAGON)
    expect(effectiveLayers([ATTR_REFINEMENT])).toEqual([ATTR_REFINEMENT])
    expect(litChoice([ATTR_REFINEMENT])).toBe(ATTR_REFINEMENT)
  })
})
