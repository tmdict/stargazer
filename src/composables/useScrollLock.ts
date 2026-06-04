import { onBeforeUnmount, watch, type Ref } from 'vue'

// Locks page scroll while `active` is true — for modal overlays, so the page
// behind can't scroll even when the modal itself isn't scrollable (iOS ignores
// `overflow`/`overscroll-behavior` there). Uses `position: fixed` on <body> with
// scroll-position restore, the only method iOS Safari honors reliably.
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
