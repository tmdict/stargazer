import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { State } from '@/lib/types/state'
import { useGridStore } from '@/stores/grid'

describe('gridStore — team view', () => {
  let gridStore: ReturnType<typeof useGridStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    gridStore = useGridStore()
  })

  describe('teamView', () => {
    it('defaults to false', () => {
      expect(gridStore.teamView).toBe(false)
    })

    it('is writable from outside the store', () => {
      gridStore.teamView = true
      expect(gridStore.teamView).toBe(true)
    })
  })

  describe('visibleHexes', () => {
    it('returns the full hex set when teamView is false', () => {
      expect(gridStore.visibleHexes).toEqual(gridStore.hexes)
    })

    it('returns only ally-state hexes (occupied + available) when teamView is true', () => {
      gridStore.teamView = true

      const visible = gridStore.visibleHexes
      const visibleStates = visible.map((hex) => gridStore.getTile(hex.getId()).state)

      expect(visible.length).toBeGreaterThan(0)
      for (const state of visibleStates) {
        expect([State.AVAILABLE_ALLY, State.OCCUPIED_ALLY]).toContain(state)
      }
    })

    it('excludes enemy and blocked hexes when teamView is true', () => {
      gridStore.teamView = true

      const visibleIds = new Set(gridStore.visibleHexes.map((h) => h.getId()))
      const allTiles = gridStore.getAllTiles
      const nonAllyHidden = allTiles.filter(
        (tile) =>
          tile.state !== State.AVAILABLE_ALLY &&
          tile.state !== State.OCCUPIED_ALLY &&
          tile.state !== State.DEFAULT,
      )

      // At least one non-ally tile exists in the default map; none should be visible.
      expect(nonAllyHidden.length).toBeGreaterThan(0)
      for (const tile of nonAllyHidden) {
        expect(visibleIds.has(tile.hex.getId())).toBe(false)
      }
    })
  })

  describe('viewBoxBounds', () => {
    it('returns the full grid box when teamView is false', () => {
      const bounds = gridStore.viewBoxBounds
      expect(bounds).toEqual({ x: 0, y: 0, width: 600, height: 600 })
    })

    it('keeps full width and crops only vertically when teamView is true', () => {
      gridStore.teamView = true

      const bounds = gridStore.viewBoxBounds
      expect(bounds.x).toBe(0)
      expect(bounds.width).toBe(600)
      expect(bounds.height).toBeLessThan(600)
      expect(bounds.height).toBeGreaterThan(0)
    })

    it('y can be negative to provide top padding for character sprites near SVG y=0', () => {
      gridStore.teamView = true

      // Bounds.y = minY - topPad. If the topmost ally hex's top corner sits within
      // topPad pixels of SVG y=0, bounds.y is negative — this becomes top padding
      // inside the clip wrapper so perspective-mode sprites don't clip.
      const bounds = gridStore.viewBoxBounds
      // y + height should always reflect (maxY + bottomPad) regardless of sign of y.
      expect(bounds.height).toBeGreaterThan(0)
    })

    it('falls back to full grid box when teamView is on but no ally tiles exist', () => {
      // Strip ally states off every tile so visibleHexes is empty.
      for (const hex of gridStore.hexes) {
        gridStore.setState(hex, State.DEFAULT)
      }
      gridStore.teamView = true

      const bounds = gridStore.viewBoxBounds
      expect(bounds).toEqual({ x: 0, y: 0, width: 600, height: 600 })
    })

    it('scales bounds with the breakpoint hex size', () => {
      gridStore.updateBreakpoint('mobile') // hexSize 23, scale 0.575
      gridStore.teamView = true

      const bounds = gridStore.viewBoxBounds
      expect(bounds.width).toBe(345) // 600 * 0.575
      expect(bounds.x).toBe(0)
      expect(bounds.height).toBeLessThanOrEqual(345)
    })
  })
})
