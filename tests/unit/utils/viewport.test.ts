// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

import { clampX, clampY, scrollbarGutter, viewportWidth } from '@/utils/viewport'

// Models a classic (non-overlay) scrollbar: the layout viewport is narrower
// than the window, the divergence the module exists to get right.
const setViewport = (clientWidth: number, clientHeight: number, gutter = 15): void => {
  Object.defineProperty(document.documentElement, 'clientWidth', {
    value: clientWidth,
    configurable: true,
  })
  Object.defineProperty(document.documentElement, 'clientHeight', {
    value: clientHeight,
    configurable: true,
  })
  vi.stubGlobal('innerWidth', clientWidth + gutter)
  vi.stubGlobal('innerHeight', clientHeight)
}

afterEach(() => vi.unstubAllGlobals())

describe('viewport', () => {
  it('measures the layout viewport, not the window', () => {
    setViewport(800, 600)
    expect(viewportWidth()).toBe(800)
    expect(scrollbarGutter()).toBe(15)
  })

  describe('clampX', () => {
    it('returns an in-bounds left edge unchanged', () => {
      setViewport(800, 600)
      expect(clampX(100, 300, 10)).toBe(100)
    })

    it('clamps against the layout viewport, clear of the scrollbar', () => {
      setViewport(800, 600)
      expect(clampX(700, 300, 10)).toBe(490)
    })

    it('pins to the left margin when the box cannot fit', () => {
      setViewport(200, 600)
      expect(clampX(-50, 300, 10)).toBe(10)
    })
  })

  describe('clampY', () => {
    it('clamps to the bottom edge and pins to the top margin', () => {
      setViewport(800, 600)
      expect(clampY(550, 100, 8)).toBe(492)
      expect(clampY(-20, 100, 8)).toBe(8)
    })
  })
})
