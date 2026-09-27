import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LONG_PRESS_MS, LONG_PRESS_RING_DELAY_MS, useLongPress } from '@/composables/useLongPress'

// The node test environment has no DOM; the composable only uses document as
// an event target for its press and click-swallow listeners.
const doc = new EventTarget()
vi.stubGlobal('document', doc)

const PRESS_ID = 7

const press = (overrides: Partial<PointerEvent> = {}) =>
  ({
    isPrimary: true,
    button: 0,
    pointerId: PRESS_ID,
    clientX: 0,
    clientY: 0,
    ...overrides,
  }) as PointerEvent

// Dispatches a document event carrying the given pointer fields.
const emit = (type: string, fields: Record<string, unknown> = {}): Event => {
  const event = Object.assign(new Event(type, { cancelable: true }), fields)
  doc.dispatchEvent(event)
  return event
}

const release = () => emit('pointerup', { pointerId: PRESS_ID })
const click = () => emit('click')
const contextMenu = (fields: Record<string, unknown> = {}) =>
  Object.assign(new Event('contextmenu', { cancelable: true }), fields) as unknown as MouseEvent

describe('useLongPress', () => {
  let onHold: ReturnType<typeof vi.fn<(target: string) => void>>
  let hold: ReturnType<typeof useLongPress<string>>

  beforeEach(() => {
    vi.useFakeTimers()
    onHold = vi.fn<(target: string) => void>()
    hold = useLongPress(onHold)
  })

  afterEach(() => {
    // End any press and let a pending click swallow expire.
    emit('pointercancel')
    vi.advanceTimersByTime(5000)
    vi.useRealTimers()
  })

  it('shows the ring after the delay and fires once the hold completes', () => {
    hold.start(press(), 'unit')
    vi.advanceTimersByTime(LONG_PRESS_RING_DELAY_MS - 1)
    expect(hold.pressing.value).toBeNull()
    vi.advanceTimersByTime(1)
    expect(hold.pressing.value).toBe('unit')

    vi.advanceTimersByTime(LONG_PRESS_MS - LONG_PRESS_RING_DELAY_MS)
    expect(onHold).toHaveBeenCalledExactlyOnceWith('unit')
    expect(hold.pressing.value).toBeNull()
  })

  it('leaves a quick press as an ordinary click', () => {
    hold.start(press(), 'unit')
    vi.advanceTimersByTime(LONG_PRESS_RING_DELAY_MS - 50)
    release()
    expect(click().defaultPrevented).toBe(false)

    vi.advanceTimersByTime(LONG_PRESS_MS)
    expect(onHold).not.toHaveBeenCalled()
  })

  it('swallows the click of a release made after the ring shows', () => {
    hold.start(press(), 'unit')
    vi.advanceTimersByTime(LONG_PRESS_RING_DELAY_MS + 50)
    release()

    expect(click().defaultPrevented).toBe(true)
    expect(hold.pressing.value).toBeNull()
    vi.advanceTimersByTime(LONG_PRESS_MS)
    expect(onHold).not.toHaveBeenCalled()
  })

  it('swallows only the click that trails a completed hold', () => {
    hold.start(press(), 'unit')
    vi.advanceTimersByTime(LONG_PRESS_MS)
    release()

    expect(click().defaultPrevented).toBe(true)
    expect(click().defaultPrevented).toBe(false)
  })

  it('disarms the swallow on the next press when the browser sent no click', () => {
    hold.start(press(), 'unit')
    vi.advanceTimersByTime(LONG_PRESS_MS)
    release()

    emit('pointerdown')
    expect(click().defaultPrevented).toBe(false)
  })

  it('tolerates a small wobble but abandons the hold on a real move', () => {
    hold.start(press(), 'unit')
    emit('pointermove', { pointerId: PRESS_ID, clientX: 4, clientY: 4 })
    vi.advanceTimersByTime(LONG_PRESS_RING_DELAY_MS)
    expect(hold.pressing.value).toBe('unit')

    emit('pointermove', { pointerId: PRESS_ID, clientX: 20, clientY: 0 })
    expect(hold.pressing.value).toBeNull()
    vi.advanceTimersByTime(LONG_PRESS_MS)
    expect(onHold).not.toHaveBeenCalled()
  })

  it('ignores moves from another pointer', () => {
    hold.start(press(), 'unit')
    emit('pointermove', { pointerId: PRESS_ID + 1, clientX: 50, clientY: 50 })
    vi.advanceTimersByTime(LONG_PRESS_MS)
    expect(onHold).toHaveBeenCalledOnce()
  })

  it('yields to a drag', () => {
    hold.start(press(), 'unit')
    emit('dragstart')
    vi.advanceTimersByTime(LONG_PRESS_MS)
    expect(onHold).not.toHaveBeenCalled()
  })

  it('ignores secondary buttons and non-primary pointers', () => {
    hold.start(press({ button: 2 }), 'unit')
    hold.start(press({ isPrimary: false }), 'unit')
    vi.advanceTimersByTime(LONG_PRESS_MS)
    expect(onHold).not.toHaveBeenCalled()
  })

  describe('context menu', () => {
    it('opens on a mouse right-click and suppresses the browser menu', () => {
      const event = contextMenu({ pointerType: 'mouse' })
      hold.onContextMenu(event, 'unit')
      expect(event.defaultPrevented).toBe(true)
      expect(onHold).toHaveBeenCalledWith('unit')
    })

    it('keeps the browser menu on Shift+right-click', () => {
      const event = contextMenu({ pointerType: 'mouse', shiftKey: true })
      hold.onContextMenu(event, 'unit')
      expect(event.defaultPrevented).toBe(false)
      expect(onHold).not.toHaveBeenCalled()
    })

    it('completes a touch hold early, once', () => {
      hold.start(press(), 'unit')
      vi.advanceTimersByTime(LONG_PRESS_RING_DELAY_MS + 100)
      const event = contextMenu({ pointerType: 'touch' })
      hold.onContextMenu(event, 'unit')
      expect(event.defaultPrevented).toBe(true)
      expect(onHold).toHaveBeenCalledOnce()

      vi.advanceTimersByTime(LONG_PRESS_MS)
      expect(onHold).toHaveBeenCalledOnce()
    })

    it('ignores a touch context menu with no hold in progress', () => {
      const event = contextMenu({ pointerType: 'touch' })
      hold.onContextMenu(event, 'unit')
      expect(event.defaultPrevented).toBe(true)
      expect(onHold).not.toHaveBeenCalled()
    })
  })
})
