import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'

import { useGridSwap } from '@/composables/useGridSwap'
import { useGrids } from '@/stores/grids'

// Minimal pointer events: startFromButton reads button + coords + stopPropagation; the
// overlay handlers read only coords.
const buttonPress = () =>
  ({ button: 0, clientX: 0, clientY: 0, stopPropagation: () => {} }) as unknown as PointerEvent
const at = (x: number, y: number) => ({ clientX: x, clientY: y }) as PointerEvent

const SOURCE = 1
const TARGET = 2
const OTHER = 3

describe('useGridSwap target selection', () => {
  let swap: ReturnType<typeof useGridSwap>
  let swapBoards: MockInstance

  // A tap on a board overlay: press and release in place.
  const tap = (boardId: number, x = 50, y = 50) => {
    swap.onOverlayDown(boardId, at(x, y))
    swap.onOverlayUp(boardId, at(x, y))
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    swap = useGridSwap()
    swap.cancel() // clear the module-level singleton between tests
    swapBoards = vi.spyOn(useGrids(), 'swapBoards').mockImplementation(() => true)
  })

  describe('tap layout (two-step)', () => {
    beforeEach(() => swap.startFromButton(SOURCE, buttonPress(), false)) // draggable off

    it('previews a target on the first tap without swapping', () => {
      tap(TARGET)
      expect(swap.pendingId.value).toBe(TARGET)
      expect(swap.isSwapping.value).toBe(true)
      expect(swapBoards).not.toHaveBeenCalled()
    })

    it('commits on a second tap of the previewed target', () => {
      tap(TARGET)
      tap(TARGET)
      expect(swapBoards).toHaveBeenCalledWith(SOURCE, TARGET)
      expect(swap.isSwapping.value).toBe(false)
    })

    it('moves the preview when a different board is tapped', () => {
      tap(TARGET)
      tap(OTHER)
      expect(swap.pendingId.value).toBe(OTHER)
      expect(swapBoards).not.toHaveBeenCalled()
    })

    it('cancels when the source board is tapped', () => {
      tap(SOURCE)
      expect(swap.isSwapping.value).toBe(false)
      expect(swapBoards).not.toHaveBeenCalled()
    })

    it('ignores a swipe (release past the travel limit)', () => {
      swap.onOverlayDown(TARGET, at(0, 0))
      swap.onOverlayUp(TARGET, at(0, 40))
      expect(swap.pendingId.value).toBeNull()
      expect(swap.isSwapping.value).toBe(true)
    })

    it('ignores a release with no matching press (the arming tap over a fresh overlay)', () => {
      swap.onOverlayUp(TARGET, at(50, 50))
      expect(swap.pendingId.value).toBeNull()
      expect(swapBoards).not.toHaveBeenCalled()
    })
  })

  describe('drag / mouse layout', () => {
    beforeEach(() => swap.startFromButton(SOURCE, buttonPress(), true)) // draggable on

    it('commits on the first tap, with no confirm step', () => {
      tap(TARGET)
      expect(swapBoards).toHaveBeenCalledWith(SOURCE, TARGET)
      expect(swap.isSwapping.value).toBe(false)
    })
  })
})
