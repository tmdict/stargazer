import { beforeEach, describe, expect, it } from 'vitest'

import { resetAttrLayerSelection, useAttrLayerSelection } from '@/composables/useAttrLayerSelection'
import { ATTR_PARAGON, ATTR_REFINEMENT } from '@/lib/characters/attributes'

describe('useAttrLayerSelection', () => {
  beforeEach(() => {
    resetAttrLayerSelection()
  })

  it('defaults to paragon armed and toggles layers as a set', () => {
    const { isArmed, toggle } = useAttrLayerSelection()
    expect(isArmed(ATTR_PARAGON)).toBe(true)
    expect(isArmed(ATTR_REFINEMENT)).toBe(false)
    toggle(ATTR_REFINEMENT)
    expect(isArmed(ATTR_PARAGON)).toBe(true)
    expect(isArmed(ATTR_REFINEMENT)).toBe(true)
    toggle(ATTR_PARAGON)
    expect(isArmed(ATTR_PARAGON)).toBe(false)
    expect(isArmed(ATTR_REFINEMENT)).toBe(true)
  })

  it('never disarms the last armed layer', () => {
    const { isArmed, toggle } = useAttrLayerSelection()
    toggle(ATTR_PARAGON)
    expect(isArmed(ATTR_PARAGON)).toBe(true)
  })

  it('is one shared selection across consumers', () => {
    const a = useAttrLayerSelection()
    const b = useAttrLayerSelection()
    a.toggle(ATTR_REFINEMENT)
    expect(b.isArmed(ATTR_REFINEMENT)).toBe(true)
  })

  it('edits only visible layers: armed ∩ visible, falling back to visible', () => {
    const { toggle, effectiveLayers } = useAttrLayerSelection()
    expect(effectiveLayers([ATTR_PARAGON, ATTR_REFINEMENT])).toEqual([ATTR_PARAGON])
    toggle(ATTR_REFINEMENT)
    expect(effectiveLayers([ATTR_PARAGON, ATTR_REFINEMENT])).toEqual([
      ATTR_PARAGON,
      ATTR_REFINEMENT,
    ])
    // The armed layer's badges hidden: the visible layer acts as armed instead
    // of taps silently editing an invisible value.
    expect(effectiveLayers([ATTR_REFINEMENT])).toEqual([ATTR_REFINEMENT])
    expect(effectiveLayers([])).toEqual([])
  })
})
