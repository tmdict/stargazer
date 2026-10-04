import { nextTick, onUnmounted, ref, watch, type CSSProperties, type Ref } from 'vue'

import { clampX, PANEL_MIN_HEIGHT, VIEWPORT_MARGIN, viewportHeight } from '@/utils/viewport'

const GAP = 4

/* Style for a dropdown panel teleported to <body> with `position: fixed`:
 * under its anchor, inside the viewport's sides, and no taller than the room
 * down to the viewport's bottom (pair it with `overflow-y: auto`). A panel
 * left inside a scrolling parent is cut off where that parent ends, and the
 * hero pickers shrink to a few rows once a filter is on. Placed on open, and
 * again on every scroll and resize while open, so it follows its anchor. */
export function useFloatingPanel(
  anchorRef: Ref<HTMLElement | undefined>,
  panelRef: Ref<HTMLElement | undefined>,
  active: () => boolean,
): Ref<CSSProperties | undefined> {
  const style = ref<CSSProperties>()

  const place = (): void => {
    const anchor = anchorRef.value?.getBoundingClientRect()
    const panel = panelRef.value
    if (!anchor || !panel) return
    const top = anchor.bottom + GAP
    const width = Math.max(panel.offsetWidth, anchor.width)
    style.value = {
      top: `${top}px`,
      left: `${clampX(anchor.left, width, VIEWPORT_MARGIN)}px`,
      minWidth: `${anchor.width}px`,
      maxHeight: `${Math.max(viewportHeight() - top - VIEWPORT_MARGIN, PANEL_MIN_HEIGHT)}px`,
    }
  }

  const stop = (): void => {
    window.removeEventListener('scroll', place, { capture: true })
    window.removeEventListener('resize', place)
  }

  watch(active, async (on) => {
    if (!on) {
      stop()
      style.value = undefined
      return
    }
    // Capture: a scroll inside a nested scroller does not bubble to the window.
    window.addEventListener('scroll', place, { capture: true, passive: true })
    window.addEventListener('resize', place)
    await nextTick()
    place()
  })
  onUnmounted(stop)

  return style
}
