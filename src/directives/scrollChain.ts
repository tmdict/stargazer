import type { Directive } from 'vue'

/* v-scroll-chain: wheel scrolling that moves a region's own content first.
 *
 * Vertical (default): scrolls the inner content until a boundary, then chains to
 * the page (the inner scrolls first; the page takes over at the top/bottom).
 * Native `overflow: auto` should do this, but some nested-flex layouts let the
 * page absorb the wheel first, so this forces the inner-first order.
 *
 * Horizontal (`v-scroll-chain.horizontal`): drives a horizontal scroller (e.g. the
 * 5 v 5 board row) from the vertical wheel — a mouse wheel only emits deltaY, so
 * it maps to scrollLeft — and is *contained*: it never chains to the page, so
 * reaching either end doesn't flip the gesture into a vertical page scroll.
 *
 * No-op when the element has nothing to scroll, so the page scrolls normally then.
 * Registered globally (main.ts / main.ssg.ts); add to a region's scroll element.
 * Not for modals/popups, where chaining to the page behind is unwanted (those keep
 * overscroll-behavior: contain).
 */

const handlers = new WeakMap<HTMLElement, (e: WheelEvent) => void>()

function makeHandler(el: HTMLElement, horizontal: boolean) {
  return (e: WheelEvent): void => {
    if (e.deltaY === 0) return
    const clientSize = horizontal ? el.clientWidth : el.clientHeight
    const scrollSize = horizontal ? el.scrollWidth : el.scrollHeight
    if (scrollSize <= clientSize) return // nothing to scroll: let the page handle it

    // Normalize line/page deltas to pixels (Firefox can report DOM_DELTA_LINE).
    const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? clientSize : 1)

    if (horizontal) {
      // Contained: the wheel drives the row and never escapes to the page, so
      // reaching either end doesn't suddenly scroll the page (the browser clamps
      // scrollLeft at the boundaries).
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
