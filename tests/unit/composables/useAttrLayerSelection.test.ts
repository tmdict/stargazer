import { beforeEach, describe, expect, it } from 'vitest'

import { resetAttrLayerSelection, useAttrLayerSelection } from '@/composables/useAttrLayerSelection'
import { ATTR_PARAGON, ATTR_REFINEMENT } from '@/lib/characters/attributes'

const BOTH = [ATTR_PARAGON, ATTR_REFINEMENT]

describe('useAttrLayerSelection', () => {
  beforeEach(() => {
    resetAttrLayerSelection()
  })

  it('defaults to paragon and switches layers exclusively', () => {
    const { select, effectiveLayers, litChoice } = useAttrLayerSelection()
    expect(effectiveLayers(BOTH)).toEqual([ATTR_PARAGON])
    expect(litChoice(BOTH)).toBe(ATTR_PARAGON)
    select(ATTR_REFINEMENT)
    expect(effectiveLayers(BOTH)).toEqual([ATTR_REFINEMENT])
    expect(litChoice(BOTH)).toBe(ATTR_REFINEMENT)
    select(ATTR_PARAGON)
    expect(effectiveLayers(BOTH)).toEqual([ATTR_PARAGON])
    expect(litChoice(BOTH)).toBe(ATTR_PARAGON)
  })

  it('ALL edits every visible layer', () => {
    const { select, effectiveLayers, litChoice } = useAttrLayerSelection()
    select('all')
    expect(effectiveLayers(BOTH)).toEqual(BOTH)
    expect(litChoice(BOTH)).toBe('all')
    select(ATTR_REFINEMENT)
    expect(effectiveLayers(BOTH)).toEqual([ATTR_REFINEMENT])
  })

  it('re-selecting the current chip keeps it selected', () => {
    const { select, effectiveLayers } = useAttrLayerSelection()
    select(ATTR_PARAGON)
    expect(effectiveLayers(BOTH)).toEqual([ATTR_PARAGON])
  })

  it('is one shared selection across consumers', () => {
    const a = useAttrLayerSelection()
    const b = useAttrLayerSelection()
    a.select(ATTR_REFINEMENT)
    expect(b.effectiveLayers(BOTH)).toEqual([ATTR_REFINEMENT])
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
