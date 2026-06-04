import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { TABLET_MAX_WIDTH } from '@/utils/breakpoints'

interface Options {
  /** Collapsed (peek) visible height, in px. */
  peek: number
  /** Expanded visible height — a fraction of the viewport (<1) or px (>=1). */
  expanded: number
  /** Start expanded (vs. peek) when first mounted on a mobile viewport. */
  initialExpanded?: boolean
  /** Max viewport width treated as mobile. */
  breakpoint?: number
}

/**
 * Drag-to-resize bottom-sheet state for a `position: fixed` panel.
 *
 * SSR-safe and progressive: the panel's collapsed/expanded *layout* is expected
 * to come from CSS (so SSG markup and hydration match); this composable only
 * adds the interactive drag (and a tap-to-toggle) once mounted on a touch
 * viewport. `sheetStyle` is `undefined` on desktop so the CSS column layout wins.
 */
export function useBottomSheet(opts: Options) {
  const breakpoint = opts.breakpoint ?? TABLET_MAX_WIDTH

  const isMobile = ref(false)
  const expanded = ref(false)
  const dragging = ref(false)
  const dragDelta = ref(0) // px, positive = dragged down
  const viewportH = ref(800)

  const expandedPx = computed(() =>
    opts.expanded < 1 ? opts.expanded * viewportH.value : opts.expanded,
  )

  // Live visible height (clamped between peek and expanded), then the translateY
  // that hides everything below it on the expanded-height-tall element.
  const visible = computed(() => {
    const base = expanded.value ? expandedPx.value : opts.peek
    return Math.max(opts.peek, Math.min(expandedPx.value, base - dragDelta.value))
  })
  // Height shares the transform's basis so the collapsed peek is exactly `peek`px
  // regardless of how CSS `vh` resolves (vh vs innerHeight diverge under mobile
  // toolbars / DevTools emulation, which otherwise hides the collapsed sheet).
  const sheetStyle = computed(() =>
    isMobile.value
      ? {
          height: `${expandedPx.value}px`,
          transform: `translateY(${expandedPx.value - visible.value}px)`,
        }
      : undefined,
  )

  let startY = 0
  // Timestamp of the last touch release. Touch devices fire emulated mouse
  // events right after the touch sequence; we use this to ignore them.
  let lastTouchEnd = 0

  // Flick-to-toggle: a quick swipe snaps in its direction regardless of distance.
  const FLICK_VELOCITY = 0.5 // px/ms (≈500 px/s); above this a release is a flick
  let lastMoveY = 0
  let lastMoveTime = 0
  let velocity = 0 // px/ms, positive = downward

  function dragStart(clientY: number) {
    if (!isMobile.value) return
    dragging.value = true
    startY = clientY
    dragDelta.value = 0
    lastMoveY = clientY
    lastMoveTime = Date.now()
    velocity = 0
  }
  function dragMove(clientY: number) {
    if (!dragging.value) return
    dragDelta.value = clientY - startY
    const now = Date.now()
    const dt = now - lastMoveTime
    if (dt > 0) {
      velocity = (clientY - lastMoveY) / dt
      lastMoveY = clientY
      lastMoveTime = now
    }
  }
  function dragEnd(allowTap = true) {
    if (!dragging.value) return
    dragging.value = false
    // A flick (quick release) wins first — open/close in its direction even on a
    // short swipe. Ignore stale velocity from a finger that paused before lifting.
    const isFlick = Date.now() - lastMoveTime < 100 && Math.abs(velocity) >= FLICK_VELOCITY
    if (isFlick) {
      expanded.value = velocity < 0 // upward → expand, downward → collapse
    } else if (allowTap && Math.abs(dragDelta.value) < 8) {
      // A near-stationary release is a tap (toggle). Content-initiated drags pass
      // allowTap=false so a small overscroll settles back instead of toggling.
      expanded.value = !expanded.value
    } else {
      expanded.value = visible.value >= (opts.peek + expandedPx.value) / 2
    }
    dragDelta.value = 0
  }

  function onTouchStart(e: TouchEvent) {
    dragStart(e.touches[0]!.clientY)
  }
  function onTouchMove(e: TouchEvent) {
    dragMove(e.touches[0]!.clientY)
  }
  function onTouchEnd() {
    lastTouchEnd = Date.now()
    dragEnd()
  }

  // Mouse drag for narrow desktop (no touch events). Tracks move/up on the window
  // so the drag survives the cursor leaving the element; `onMove` returns whether
  // to preventDefault. `removeMouseListeners` cancels an active drag on unmount.
  let removeMouseListeners: (() => void) | null = null
  function runMouseDrag(onMove: (clientY: number) => boolean, onEnd: () => void) {
    removeMouseListeners?.()
    const move = (e: MouseEvent) => {
      if (onMove(e.clientY)) e.preventDefault()
    }
    const end = () => {
      removeMouseListeners?.()
      onEnd()
    }
    removeMouseListeners = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', end)
      removeMouseListeners = null
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', end)
  }

  function onMouseDown(e: MouseEvent) {
    // Skip the emulated mouse event a touch device fires right after a tap —
    // otherwise dragEnd runs twice (touch + mouse) and the toggle snaps back.
    if (Date.now() - lastTouchEnd < 700) return
    dragStart(e.clientY)
    if (!dragging.value) return
    e.preventDefault() // don't text-select while dragging
    runMouseDrag((clientY) => {
      dragMove(clientY)
      return false
    }, dragEnd)
  }

  // State for the content-area drag (swipe-to-expand / overscroll-to-collapse);
  // contentDragStep below holds the gesture rules.
  const CONTENT_DRAG_THRESHOLD = 4 // px of travel before the sheet engages
  let scrollEl: HTMLElement | null = null
  let anchorY = 0

  // Nearest scrollable ancestor of the touch target (the element that owns the
  // sheet's content scroll); null when nothing scrolls (short content).
  function findScrollable(target: EventTarget | null): HTMLElement | null {
    let el = target instanceof HTMLElement ? target : null
    while (el) {
      if (el.scrollHeight > el.clientHeight) {
        const overflowY = getComputedStyle(el).overflowY
        if (overflowY === 'auto' || overflowY === 'scroll') return el
      }
      el = el.parentElement
    }
    return null
  }

  // Begin the sheet drag from the anchor and apply the current position at once.
  function engageDrag(clientY: number): void {
    dragStart(anchorY)
    dragMove(clientY)
  }

  // Drives a content gesture frame. Returns true when the caller should suppress
  // native scroll because the sheet — not the content — is handling the gesture.
  //
  // Native scroll is allowed in just two cases, both while expanded: the content
  // is scrolled below its top, or the finger is moving up at the top. Otherwise
  // the sheet owns the gesture — collapsed (swipe up to expand) or an at-top
  // downward pull (swipe down to collapse) — so it suppresses scroll from the
  // first move (the page never drags) and engages the drag past the threshold.
  function contentDragStep(clientY: number): boolean {
    if (dragging.value) {
      dragMove(clientY)
      return true
    }
    if (expanded.value) {
      // Scrolled below the top: let it scroll, keeping the anchor live so a later
      // pull is measured from the moment the top is reached.
      if (scrollEl && scrollEl.scrollTop > 0) {
        anchorY = clientY
        return false
      }
      // At the top, moving up: scroll the content, not the sheet.
      if (clientY < anchorY) {
        anchorY = clientY
        return false
      }
    }
    if (Math.abs(clientY - anchorY) > CONTENT_DRAG_THRESHOLD) engageDrag(clientY)
    return true
  }

  function onContentTouchStart(e: TouchEvent) {
    if (!isMobile.value) return
    scrollEl = findScrollable(e.target)
    anchorY = e.touches[0]!.clientY
  }
  function onContentTouchMove(e: TouchEvent) {
    if (!isMobile.value) return
    if (contentDragStep(e.touches[0]!.clientY)) e.preventDefault()
  }
  function onContentTouchEnd() {
    if (!dragging.value) return
    lastTouchEnd = Date.now()
    dragEnd(false)
  }

  function onContentMouseDown(e: MouseEvent) {
    if (!isMobile.value) return
    if (Date.now() - lastTouchEnd < 700) return
    scrollEl = findScrollable(e.target)
    anchorY = e.clientY
    runMouseDrag(contentDragStep, () => dragEnd(false))
  }

  function update() {
    viewportH.value = window.innerHeight
    isMobile.value = window.matchMedia(`(max-width: ${breakpoint}px)`).matches
    if (!isMobile.value) expanded.value = false
  }

  // Re-measure next frame too: emulated/mobile viewports can report stale
  // dimensions at mount/toggle without a settled follow-up resize.
  function scheduleUpdate() {
    update()
    if (typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(update)
  }

  onMounted(() => {
    scheduleUpdate()
    // Reveal opens it (animating up from the CSS peek) only when asked.
    if (isMobile.value && opts.initialExpanded) expanded.value = true
    window.addEventListener('resize', scheduleUpdate)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('resize', scheduleUpdate)
    removeMouseListeners?.()
  })

  return {
    isMobile,
    expanded,
    dragging,
    sheetStyle,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onMouseDown,
    onContentTouchStart,
    onContentTouchMove,
    onContentTouchEnd,
    onContentMouseDown,
  }
}
