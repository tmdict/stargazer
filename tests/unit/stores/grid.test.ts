import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { State } from '@/lib/types/state'
import { useGridStore } from '@/stores/grid'
import { useGrids } from '@/stores/grids'

// visibleHexes / viewBoxBounds are derived per board, so they're read from the
// active GridContext (their owner); gridStore drives the shared team-view flag,
// breakpoint, and per-tile state.
describe('grid team view (active board geometry)', () => {
  let gridStore: ReturnType<typeof useGridStore>
  let grids: ReturnType<typeof useGrids>

  beforeEach(() => {
    setActivePinia(createPinia())
    gridStore = useGridStore()
    grids = useGrids()
  })

  describe('visibleHexes', () => {
    it('returns the full hex set when teamView is false', () => {
      expect(grids.active!.visibleHexes).toEqual(gridStore.hexes)
    })

    it('returns only ally-state hexes (occupied + available) when teamView is true', () => {
      gridStore.teamView = true

      const visible = grids.active!.visibleHexes
      const visibleStates = visible.map((hex) => gridStore.getTile(hex.getId()).state)

      expect(visible.length).toBeGreaterThan(0)
      expect(visible.length).toBeLessThan(gridStore.hexes.length)
      for (const state of visibleStates) {
        expect([State.AVAILABLE_ALLY, State.OCCUPIED_ALLY]).toContain(state)
      }
    })
  })

  describe('viewBoxBounds', () => {
    it('returns the full grid box when teamView is false', () => {
      const bounds = grids.active!.viewBoxBounds
      expect(bounds).toEqual({ x: 0, y: 0, width: 600, height: 600 })
    })

    it('crops to the shown team on both axes when teamView is true', () => {
      gridStore.teamView = true

      const bounds = grids.active!.viewBoxBounds
      expect(bounds.x).toBeGreaterThan(0)
      expect(bounds.width).toBeLessThan(600)
      expect(bounds.width).toBeGreaterThan(0)
      expect(bounds.height).toBeLessThan(600)
      expect(bounds.height).toBeGreaterThan(0)
    })

    it('falls back to full grid box when teamView is on but no ally tiles exist', () => {
      // Strip ally states off every tile so visibleHexes is empty.
      for (const hex of gridStore.hexes) {
        gridStore.setState(hex, State.DEFAULT)
      }
      gridStore.teamView = true

      const bounds = grids.active!.viewBoxBounds
      expect(bounds).toEqual({ x: 0, y: 0, width: 600, height: 600 })
    })

    it('scales bounds with the breakpoint hex size', () => {
      gridStore.teamView = true

      gridStore.updateBreakpoint('desktop') // hexSize 40, scale 1.0
      const desktop = { ...grids.active!.viewBoxBounds }
      gridStore.updateBreakpoint('mobile') // hexSize 23, scale 0.575
      const mobile = grids.active!.viewBoxBounds

      // Every term (corners + pads) is linear in hex size, so the cropped box
      // scales by the hex-size ratio.
      const ratio = 23 / 40
      expect(mobile.width).toBeCloseTo(desktop.width * ratio)
      expect(mobile.height).toBeCloseTo(desktop.height * ratio)
      expect(mobile.x).toBeCloseTo(desktop.x * ratio)
    })
  })
})
