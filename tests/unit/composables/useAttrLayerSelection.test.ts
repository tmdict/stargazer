import { beforeEach, describe, expect, it } from 'vitest'

import { resetAttrLayerSelection, useAttrLayerSelection } from '@/composables/useAttrLayerSelection'
import { ATTR_PARAGON, ATTR_REFINEMENT } from '@/lib/characters/attributes'

const BOTH = [ATTR_PARAGON, ATTR_REFINEMENT]

describe('useAttrLayerSelection', () => {
  beforeEach(() => {
    resetAttrLayerSelection()
  })

  it('defaults to paragon armed and toggles layers as a set', () => {
    const { isArmed, toggle } = useAttrLayerSelection()
    expect(isArmed(ATTR_PARAGON)).toBe(true)
    expect(isArmed(ATTR_REFINEMENT)).toBe(false)
    toggle(ATTR_REFINEMENT, BOTH)
    expect(isArmed(ATTR_PARAGON)).toBe(true)
    expect(isArmed(ATTR_REFINEMENT)).toBe(true)
    toggle(ATTR_PARAGON, BOTH)
    expect(isArmed(ATTR_PARAGON)).toBe(false)
    expect(isArmed(ATTR_REFINEMENT)).toBe(true)
  })

  it('never disarms the last armed layer', () => {
    const { isArmed, toggle } = useAttrLayerSelection()
    toggle(ATTR_PARAGON, BOTH)
    expect(isArmed(ATTR_PARAGON)).toBe(true)
  })

  it('is one shared selection across consumers', () => {
    const a = useAttrLayerSelection()
    const b = useAttrLayerSelection()
    a.toggle(ATTR_REFINEMENT, BOTH)
    expect(b.isArmed(ATTR_REFINEMENT)).toBe(true)
  })

  it('edits only visible layers: armed ∩ visible, falling back to visible', () => {
    const { toggle, effectiveLayers } = useAttrLayerSelection()
    expect(effectiveLayers(BOTH)).toEqual([ATTR_PARAGON])
    toggle(ATTR_REFINEMENT, BOTH)
    expect(effectiveLayers(BOTH)).toEqual([ATTR_PARAGON, ATTR_REFINEMENT])
    // The armed layer's badges hidden: the visible layer acts as armed instead
    // of taps silently editing an invisible value.
    expect(effectiveLayers([ATTR_REFINEMENT])).toEqual([ATTR_REFINEMENT])
    expect(effectiveLayers([])).toEqual([])
  })

  // Clicks act on the displayed (effective) set: a chip lit by the fallback
  // must never toggle hidden armed state with no visible result.
  it('toggling a fallback-lit chip adopts the displayed set instead of arming hidden layers', () => {
    const { isArmed, toggle, effectiveLayers } = useAttrLayerSelection()
    // Armed {P}, paragon pref off: R is lit by the fallback. Clicking R is the
    // last-lit no-op, but the armed set becomes exactly what is displayed.
    toggle(ATTR_REFINEMENT, [ATTR_REFINEMENT])
    expect(isArmed(ATTR_REFINEMENT)).toBe(true)
    expect(isArmed(ATTR_PARAGON)).toBe(false)
    // Re-enabling the paragon pref does not surface a surprise ALL state.
    expect(effectiveLayers(BOTH)).toEqual([ATTR_REFINEMENT])
  })

  it('toggling with one layer hidden drops the hidden layer from the armed set', () => {
    const { toggle, effectiveLayers } = useAttrLayerSelection()
    toggle(ATTR_REFINEMENT, BOTH) // armed {P, R}
    // Refinement pref off: only P displayed; clicking P is the last-lit no-op
    // and the armed set collapses to the displayed {P}.
    toggle(ATTR_PARAGON, [ATTR_PARAGON])
    expect(effectiveLayers(BOTH)).toEqual([ATTR_PARAGON])
  })
})
