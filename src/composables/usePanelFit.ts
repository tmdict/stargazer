import { nextTick, onUnmounted, ref, watch, type Ref } from 'vue'

import { PANEL_MIN_HEIGHT, VIEWPORT_MARGIN, viewportHeight } from '@/utils/viewport'

/* Max height for a dropdown panel so it never runs past the bottom of the
 * viewport, or of the nearest ancestor marked `data-dropdown-boundary`: bind
 * it as `max-height` with `overflow-y: auto`, and a scrollbar appears only
 * when the list is taller than the room below its top edge. Panels inside
 * fixed popups can't be reached by scrolling the page, and a popup that
 * closes on mouse-leave (SelectionPopup) needs its dropdowns kept inside it.
 * Measured on open and on resize. */
export function usePanelFit(
  panelRef: Ref<HTMLElement | undefined>,
  active: () => boolean,
): Ref<string | undefined> {
  const maxHeight = ref<string>()

  const fit = (): void => {
    const panel = panelRef.value
    if (!panel) return
    const boundary = panel.parentElement?.closest('[data-dropdown-boundary]')
    const bottom = boundary
      ? Math.min(boundary.getBoundingClientRect().bottom, viewportHeight())
      : viewportHeight()
    const room = bottom - panel.getBoundingClientRect().top - VIEWPORT_MARGIN
    maxHeight.value = `${Math.max(room, PANEL_MIN_HEIGHT)}px`
  }

  watch(active, async (on) => {
    if (on) {
      window.addEventListener('resize', fit)
      await nextTick()
      fit()
    } else {
      window.removeEventListener('resize', fit)
      maxHeight.value = undefined
    }
  })
  onUnmounted(() => window.removeEventListener('resize', fit))

  return maxHeight
}
