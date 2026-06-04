import { onBeforeUnmount, watch, type Ref } from 'vue'

// Locks page scroll while `active` is true — for modal overlays. Two parts:
//  - `position: fixed` on <body> (with scroll restore) freezes content scroll,
//    the only method iOS Safari honors reliably.
//  - `overscroll-behavior: none` on <html> stops the document's own pull-to-
//    refresh / rubber-band, which the body lock and the overlay's containment
//    don't (iOS ignores overscroll-behavior on a non-scrollable overlay; the
//    overlay's containment doesn't govern the document's overscroll).
//
// Ref-counted at module scope so stacked modals share one lock and the scroll
// position is captured/restored exactly once.
let lockCount = 0
let savedScrollY = 0

function lock(): void {
  if (import.meta.env.SSR) return
  if (lockCount === 0) {
    savedScrollY = window.scrollY
    const { style } = document.body
    style.position = 'fixed'
    style.top = `-${savedScrollY}px`
    style.left = '0'
    style.right = '0'
    document.documentElement.style.overscrollBehavior = 'none'
  }
  lockCount++
}

function unlock(): void {
  if (import.meta.env.SSR || lockCount === 0) return
  lockCount--
  if (lockCount === 0) {
    const { style } = document.body
    style.position = ''
    style.top = ''
    style.left = ''
    style.right = ''
    document.documentElement.style.overscrollBehavior = ''
    window.scrollTo(0, savedScrollY)
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
