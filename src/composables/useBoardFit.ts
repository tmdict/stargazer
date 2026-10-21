import { onMounted, onUnmounted, toValue, type MaybeRefOrGetter } from 'vue'

import { useGridStore } from '@/stores/grid'
import { useGrids } from '@/stores/grids'

/* Sizes the Arena's board to a phone's width (the grid store applies it only at
 * the mobile breakpoint): the board fills its column, and only the column's width
 * changes it, so a shorter screen or content above the board pushes the board
 * down instead of resizing it. The column's width doesn't depend on the board's
 * size, so the fit never feeds back into itself. */
export function useBoardFit(column: MaybeRefOrGetter<HTMLElement | undefined>): void {
  const gridStore = useGridStore()
  const grids = useGrids()

  const fit = (): void => {
    const columnEl = toValue(column)
    const ctx = grids.active
    if (!columnEl || !ctx) return
    const style = getComputedStyle(columnEl)
    const width =
      columnEl.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
    gridStore.fitMobileBoard(width / ctx.flatWidthInRadii)
  }

  // A resize applies on the next frame, so the board's new size never lands
  // inside the observer's own callback.
  let frame = 0
  const scheduleFit = (): void => {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(fit)
  }
  let observer: ResizeObserver | null = null

  onMounted(() => {
    fit()
    observer = new ResizeObserver(scheduleFit)
    const columnEl = toValue(column)
    if (columnEl) observer.observe(columnEl)
  })

  onUnmounted(() => {
    cancelAnimationFrame(frame)
    observer?.disconnect()
    gridStore.fitMobileBoard(null)
  })
}
