import type { Directive } from 'vue'

/* v-scroll-chain: wheel scrolling that moves a region's own content first.
 *
 * Scrolls the inner content until it reaches the top or bottom, then lets the
 * wheel chain to the page. Native `overflow: auto` should do this, but some
 * nested-flex layouts let the page absorb the wheel first, so this forces the
 * inner-first order.
 *
 * No-op when the element has nothing to scroll, so the page scrolls normally then.
 * Registered globally (main.ts / main.ssg.ts); add to a region's scroll element.
 * Not for modals/popups, where chaining to the page behind is unwanted (those keep
 * overscroll-behavior: contain).
 */

const handlers = new WeakMap<HTMLElement, (e: WheelEvent) => void>()

function makeHandler(el: HTMLElement) {
  return (e: WheelEvent): void => {
    if (e.deltaY === 0) return
    const clientSize = el.clientHeight
    const scrollSize = el.scrollHeight
    if (scrollSize <= clientSize) return // nothing to scroll: let the page handle it

    // Normalize line/page deltas to pixels (Firefox can report DOM_DELTA_LINE).
    const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? clientSize : 1)

    const atTop = el.scrollTop <= 0
    const atBottom = el.scrollTop + clientSize >= scrollSize - 1
    if ((delta > 0 && !atBottom) || (delta < 0 && !atTop)) {
      e.preventDefault()
      el.scrollTop += delta
    }
  }
}

export const vScrollChain: Directive<HTMLElement> = {
  mounted(el) {
    const handler = makeHandler(el)
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
