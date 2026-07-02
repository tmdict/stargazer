import { onBeforeUnmount, watch, type Ref } from 'vue'

// Locks page scroll while `active` is true, for modal overlays.
//
// Two strategies, chosen per device:
//  - Default: `overflow: hidden` on <html> plus a padding-right compensation
//    for the vanished scrollbar. This keeps `window.scrollY` live, which
//    matters because vue-router snapshots the departing page's scroll
//    synchronously during popstate: a fixed body reads 0, and Back/Forward
//    would restore the page to the top after any navigation made while a
//    lock was held.
//  - iOS (including iPadOS, which reports MacIntel): `position: fixed` on
//    <body> with scroll save/restore, the only method iOS Safari honors
//    reliably; the popstate caveat is accepted there.
// Both set `overscroll-behavior: none` on <html> to stop the document's own
// pull-to-refresh / rubber-band.
//
// Ref-counted at module scope so stacked modals share one lock and the
// scroll position is captured/restored exactly once.
let lockCount = 0
let savedScrollY = 0

function useFixedBody(): boolean {
  return (
    /iP(hone|ad|od)/.test(navigator.platform) ||
    (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform))
  )
}

function lock(): void {
  if (import.meta.env.SSR) return
  if (lockCount === 0) {
    const root = document.documentElement
    if (useFixedBody()) {
      savedScrollY = window.scrollY
      const { style } = document.body
      style.position = 'fixed'
      style.top = `-${savedScrollY}px`
      style.left = '0'
      style.right = '0'
    } else {
      const gutter = window.innerWidth - root.clientWidth
      root.style.overflow = 'hidden'
      if (gutter > 0) document.body.style.paddingRight = `${gutter}px`
    }
    root.style.overscrollBehavior = 'none'
  }
  lockCount++
}

function unlock(): void {
  if (import.meta.env.SSR || lockCount === 0) return
  lockCount--
  if (lockCount === 0) {
    const root = document.documentElement
    if (useFixedBody()) {
      const { style } = document.body
      style.position = ''
      style.top = ''
      style.left = ''
      style.right = ''
      window.scrollTo(0, savedScrollY)
    } else {
      root.style.overflow = ''
      document.body.style.paddingRight = ''
    }
    root.style.overscrollBehavior = ''
  }
}

export function useScrollLock(active: Ref<boolean>): void {
  let held = false
  const apply = (on: boolean) => {
    if (on === held) return
    held = on
    if (on) lock()
    else unlock()
  }
  watch(active, apply, { immediate: true })
  onBeforeUnmount(() => apply(false))
}
