import type { Directive } from 'vue'

/* v-scroll-chain: wheel scrolling that moves a region's own content first.
 *
 * Vertical (default): scrolls the inner content until a boundary, then chains to
 * the page (the inner scrolls first; the page takes over at the top/bottom).
 * Native `overflow: auto` should do this, but some nested-flex layouts let the
 * page absorb the wheel first, so this forces the inner-first order.
 *
 * Horizontal (`v-scroll-chain.horizontal`): drives a horizontal scroller (e.g. the
 * 5 v 5 board row) from a mouse wheel's vertical delta (a wheel only emits deltaY,
 * so it maps to scrollLeft). A touchpad is left untouched so it scrolls natively in
 * both axes, and at either end the wheel chains to the page (down past the right
 * end, up past the left) like the vertical case.
 *
 * No-op when the element has nothing to scroll, so the page scrolls normally then.
 * Registered globally (main.ts / main.ssg.ts); add to a region's scroll element.
 * Not for modals/popups, where chaining to the page behind is unwanted (those keep
 * overscroll-behavior: contain).
 */

const handlers = new WeakMap<HTMLElement, (e: WheelEvent) => void>()

// Mouse wheel vs touchpad: there's no exact API, so infer from the event shape. A
// mouse wheel emits vertical-only, notched deltas; a touchpad emits small, smooth,
// often 2-axis deltas. The check is imperfect at the margins (a Magic Mouse reads as
// a touchpad) but right for the common laptop-trackpad-plus-wheel setup.
function isMouseWheel(e: WheelEvent): boolean {
  if (e.deltaX !== 0) return false // a standard wheel is vertical-only
  if (e.deltaMode !== 0) return true // LINE/PAGE notches (Firefox wheel)
  // wheelDeltaY counts notches (120 each), not accelerated pixels, so it stays a
  // clean multiple for a wheel; a touchpad's is small and unaligned.
  const wheelDeltaY = (e as WheelEvent & { wheelDeltaY?: number }).wheelDeltaY
  if (typeof wheelDeltaY === 'number' && wheelDeltaY !== 0) {
    return Math.abs(wheelDeltaY) % 120 === 0
  }
  return false
}

function makeHandler(el: HTMLElement, horizontal: boolean) {
  return (e: WheelEvent): void => {
    if (e.deltaY === 0) return
    const clientSize = horizontal ? el.clientWidth : el.clientHeight
    const scrollSize = horizontal ? el.scrollWidth : el.scrollHeight
    if (scrollSize <= clientSize) return // nothing to scroll: let the page handle it

    // Normalize line/page deltas to pixels (Firefox can report DOM_DELTA_LINE).
    const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? clientSize : 1)

    if (horizontal) {
      // Only a mouse wheel is remapped to horizontal; a touchpad scrolls both axes
      // natively, so leave it alone (vertical swipes scroll the page, horizontal
      // swipes scroll the row).
      if (!isMouseWheel(e)) return
      // Inner-first, then chain: drive the row until an end, then let the wheel fall
      // through to a vertical page scroll (down past the right end, up past the left).
      const atStart = el.scrollLeft <= 0
      const atEnd = el.scrollLeft + clientSize >= scrollSize - 1
      if ((delta > 0 && atEnd) || (delta < 0 && atStart)) return
      e.preventDefault()
      el.scrollLeft += delta
      return
    }

    // Vertical: scroll the inner first; at the boundary, let the wheel chain to
    // the page.
    const atTop = el.scrollTop <= 0
    const atBottom = el.scrollTop + clientSize >= scrollSize - 1
    if ((delta > 0 && !atBottom) || (delta < 0 && !atTop)) {
      e.preventDefault()
      el.scrollTop += delta
    }
  }
}

export const vScrollChain: Directive<HTMLElement> = {
  mounted(el, binding) {
    const handler = makeHandler(el, binding.modifiers.horizontal === true)
    handlers.set(el, handler)
    el.addEventListener('wheel', handler, { passive: false })
  },
  unmounted(el) {
    const handler = handlers.get(el)
    if (handler) {
      el.removeEventListener('wheel', handler)
      handlers.delete(el)
    }
  },
}
