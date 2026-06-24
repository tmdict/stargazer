import { shallowRef, watch, type WatchSource } from 'vue'

import { useDragDrop } from './useDragDrop'
import { useTouchDetection } from './useTouchDetection'

/**
 * Hover-tooltip state shared by the grid overlays (placed characters, artifacts):
 * tracks the hovered element and its payload, showing the tooltip only on a plain,
 * still hover. Suppressed during a drag and on touch, and dismissed both when a drag
 * starts and when `dismissWhenChanges` updates: an icon pulled out from under a still
 * cursor (removal, swap, team-view crop) fires no mouseleave.
 *
 * Touch suppression relies on useTouchDetection's global flag already being set when the
 * synthetic post-tap mouseenter fires; the roster icons instead track touch
 * per-interaction via useHoverTooltip, whose single-element model doesn't fit a
 * many-icon overlay.
 *
 * @param dismissWhenChanges reactive source whose every change hides the tooltip (the
 * placement set for characters, the artifact ids for artifacts).
 */
export function useGridHoverTooltip<T>(dismissWhenChanges: WatchSource) {
  const { isDragging } = useDragDrop()
  const { isTouchDevice } = useTouchDetection()

  const hoveredEl = shallowRef<HTMLElement | null>(null)
  const hovered = shallowRef<T | null>(null)

  const show = (event: MouseEvent, payload: T | null | undefined): void => {
    if (!payload || isDragging.value || isTouchDevice.value) return
    hoveredEl.value = event.currentTarget as HTMLElement
    hovered.value = payload
  }

  const hide = (): void => {
    hoveredEl.value = null
    hovered.value = null
  }

  watch(isDragging, (dragging) => {
    if (dragging) hide()
  })
  watch(dismissWhenChanges, hide)

  return { hoveredEl, hovered, show, hide }
}
