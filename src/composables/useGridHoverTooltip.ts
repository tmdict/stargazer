import { shallowRef, watch, type WatchSource } from 'vue'

import { isTouchHover } from '@/utils/pointer'
import { useDragDrop } from './useDragDrop'

/**
 * Hover-tooltip state shared by the grid overlays (placed characters, artifacts, buff
 * tiles): tracks the hovered element and its payload, showing the tooltip only on a
 * plain, still hover. Suppressed during a drag and on touch, and dismissed both when a drag
 * starts and when `dismissWhenChanges` updates: an icon pulled out from under a still
 * cursor (removal, swap, team-view crop) fires no mouseleave.
 *
 * @param dismissWhenChanges reactive source whose every change hides the tooltip (the
 * placement set for characters and buff tiles, the artifact ids for artifacts).
 */
export function useGridHoverTooltip<T, E extends Element = HTMLElement>(
  dismissWhenChanges: WatchSource,
) {
  const { isDragging } = useDragDrop()

  const hoveredEl = shallowRef<E | null>(null)
  const hovered = shallowRef<T | null>(null)

  const show = (event: MouseEvent, payload: T | null | undefined): void => {
    if (!payload || isDragging.value || isTouchHover()) return
    hoveredEl.value = event.currentTarget as E
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
