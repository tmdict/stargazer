import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

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
  const breakpoint = opts.breakpoint ?? 768

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
  const sheetStyle = computed(() =>
    isMobile.value ? { transform: `translateY(${expandedPx.value - visible.value}px)` } : undefined,
  )

  let startY = 0
  // Timestamp of the last touch release. Touch devices fire emulated mouse
  // events right after the touch sequence; we use this to ignore them.
  let lastTouchEnd = 0

  function dragStart(clientY: number) {
    if (!isMobile.value) return
    dragging.value = true
    startY = clientY
    dragDelta.value = 0
  }
  function dragMove(clientY: number) {
    if (!dragging.value) return
    dragDelta.value = clientY - startY
  }
  function dragEnd() {
    if (!dragging.value) return
    dragging.value = false
    // A near-stationary release is a tap (toggle); otherwise snap to the nearer detent.
    if (Math.abs(dragDelta.value) < 8) {
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

  // Mouse drag — for narrow desktop viewports where touch events don't fire.
  // Tracked on the window so the drag continues when the cursor leaves the handle.
  function onMouseMove(e: MouseEvent) {
    dragMove(e.clientY)
  }
  function onMouseUp() {
    dragEnd()
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }
  function onMouseDown(e: MouseEvent) {
    // Skip the emulated mouse event a touch device fires right after a tap —
    // otherwise dragEnd runs twice (touch + mouse) and the toggle snaps back.
    if (Date.now() - lastTouchEnd < 700) return
    dragStart(e.clientY)
    if (!dragging.value) return
    e.preventDefault() // don't text-select while dragging
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  function collapse() {
    expanded.value = false
  }

  function update() {
    viewportH.value = window.innerHeight
    isMobile.value = window.matchMedia(`(max-width: ${breakpoint}px)`).matches
    if (!isMobile.value) expanded.value = false
  }

  onMounted(() => {
    update()
    // Reveal opens it (animating up from the CSS peek) only when asked.
    if (isMobile.value && opts.initialExpanded) expanded.value = true
    window.addEventListener('resize', update)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('resize', update)
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
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
    collapse,
  }
}
