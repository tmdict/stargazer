import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import type { Breakpoint } from '@/stores/grid'
import { useGridStore } from '@/stores/grid'
import { useGrids } from '@/stores/grids'

describe('the single-board hex size', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('takes a phone fit between the mobile and tablet sizes, and only on a phone', () => {
    const grids = useGrids()
    const store = useGridStore()
    const sizeAt = (breakpoint: Breakpoint): number => {
      store.updateBreakpoint(breakpoint)
      return grids.hexSize.x
    }
    const mobile = sizeAt('mobile')
    const tablet = sizeAt('tablet')

    store.fitMobileBoard(mobile + 2)
    expect(grids.hexSize.x).toBe(tablet)
    expect(sizeAt('mobile')).toBe(mobile + 2)

    store.fitMobileBoard(tablet + 10)
    expect(grids.hexSize.x).toBe(tablet)
    store.fitMobileBoard(mobile - 10)
    expect(grids.hexSize.x).toBe(mobile)

    // A page clears its fit when it leaves, so the next page gets the mobile size.
    store.fitMobileBoard(mobile + 2)
    store.fitMobileBoard(null)
    expect(grids.hexSize.x).toBe(mobile)
  })
})
