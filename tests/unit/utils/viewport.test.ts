// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

import { clampX } from '@/utils/viewport'

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

describe('clampX', () => {
  it('clamps against the layout viewport, clear of the scrollbar', () => {
    setViewport(800, 600)
    expect(clampX(700, 300, 10)).toBe(490)
  })
})
