import { getCurrentScope, onScopeDispose, shallowRef } from 'vue'

import { isTouchClick } from '@/utils/pointer'

/* Press-and-hold "inspect" gesture for board units, the game's long-press.
 * It shares the press with click-to-remove, tap-to-lift and HTML5 drag, so:
 *   - a press released before the ring delay stays an ordinary click or tap;
 *   - moving past the tolerance, or a drag starting, abandons the hold;
 *   - once the ring shows, releasing does nothing, and a completed hold opens.
 * Both endings swallow the click the release produces. The hold may open a
 * modal under the pointer, so that click would land outside it and trip its
 * click-outside close; the swallow is a document capture listener so it runs
 * before any of those handlers, whatever the click's target.
 *
 * Right-click opens directly (Shift+right-click keeps the browser menu).
 * Android reports a touch long-press as a contextmenu too, possibly before the
 * timer: it completes the hold in progress, and a stopped hold ignores it. */

export const LONG_PRESS_RING_DELAY_MS = 250
export const LONG_PRESS_MS = 550
const MOVE_TOLERANCE_PX = 8
// The swallowed click follows its pointerup directly; the next pointerdown or
// this timeout disarms, so a browser that sends no click can't eat a later one.
const SWALLOW_WINDOW_MS = 1000

const CAPTURE = { capture: true }

let swallowTimer: ReturnType<typeof setTimeout> | null = null

const swallowClick = (event: Event): void => {
  event.preventDefault()
  event.stopImmediatePropagation()
  disarmClickSwallow()
}

function disarmClickSwallow(): void {
  if (swallowTimer === null) return
  clearTimeout(swallowTimer)
  swallowTimer = null
  document.removeEventListener('click', swallowClick, CAPTURE)
  document.removeEventListener('pointerdown', disarmClickSwallow, CAPTURE)
}

function armClickSwallow(): void {
  disarmClickSwallow()
  document.addEventListener('click', swallowClick, CAPTURE)
  document.addEventListener('pointerdown', disarmClickSwallow, CAPTURE)
  swallowTimer = setTimeout(disarmClickSwallow, SWALLOW_WINDOW_MS)
}

export function useLongPress<T>(onHold: (target: T) => void) {
  // The target whose ring is showing: set after the ring delay, cleared when
  // the hold ends either way.
  const pressing = shallowRef<T | null>(null)

  let target: T | null = null
  let pointerId = -1
  let startX = 0
  let startY = 0
  let ringTimer: ReturnType<typeof setTimeout> | null = null
  let holdTimer: ReturnType<typeof setTimeout> | null = null

  const stop = (): void => {
    if (ringTimer) clearTimeout(ringTimer)
    if (holdTimer) clearTimeout(holdTimer)
    ringTimer = holdTimer = null
    target = null
    pressing.value = null
    document.removeEventListener('pointermove', onMove)
    document.removeEventListener('pointerup', onUp)
    document.removeEventListener('pointercancel', stop)
    document.removeEventListener('dragstart', stop, CAPTURE)
  }

  const fire = (): void => {
    const held = target
    stop()
    armClickSwallow()
    if (held !== null) onHold(held)
  }

  function onMove(event: PointerEvent): void {
    if (event.pointerId !== pointerId) return
    if (Math.hypot(event.clientX - startX, event.clientY - startY) > MOVE_TOLERANCE_PX) stop()
  }

  function onUp(event: PointerEvent): void {
    if (event.pointerId !== pointerId) return
    if (pressing.value !== null) armClickSwallow()
    stop()
  }

  const start = (event: PointerEvent, pressed: T): void => {
    if (!event.isPrimary || event.button !== 0) return
    stop()
    target = pressed
    pointerId = event.pointerId
    startX = event.clientX
    startY = event.clientY
    ringTimer = setTimeout(() => (pressing.value = pressed), LONG_PRESS_RING_DELAY_MS)
    holdTimer = setTimeout(fire, LONG_PRESS_MS)
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
    document.addEventListener('pointercancel', stop)
    document.addEventListener('dragstart', stop, CAPTURE)
  }

  const onContextMenu = (event: MouseEvent, clicked: T): void => {
    const touch = isTouchClick(event)
    if (event.shiftKey && !touch) return
    event.preventDefault()
    if (touch) {
      if (target !== null) fire()
      return
    }
    stop()
    onHold(clicked)
  }

  if (getCurrentScope()) onScopeDispose(stop)

  return { pressing, start, onContextMenu }
}
