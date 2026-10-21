import { onMounted, onUnmounted, toValue, type MaybeRefOrGetter } from 'vue'

import { BASE_HEX_RADIUS, BOARD_SIZE } from '@/lib/layout'
import { useGridStore } from '@/stores/grid'
import { useGrids } from '@/stores/grids'
import { smallViewportHeight } from '@/utils/viewport'

/* Sizes the Arena's board to a phone (the grid store applies it only at the mobile
 * breakpoint): as wide as its column, and no taller than the screen above the
 * bottom sheet's peek, so only the controls below the board may need a scroll.
 * Neither the column's width nor the board's top depends on the board's size, so
 * the fit never feeds back into itself. */
export function useBoardFit(
  column: MaybeRefOrGetter<HTMLElement | undefined>,
  board: MaybeRefOrGetter<HTMLElement | undefined>,
): void {
  const gridStore = useGridStore()
  const grids = useGrids()

  const fit = (): void => {
    const columnEl = toValue(column)
    const boardEl = toValue(board)
    const ctx = grids.active
    if (!columnEl || !boardEl || !ctx) return
    const style = getComputedStyle(columnEl)
    const width =
      columnEl.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
    const aboveSheet =
      smallViewportHeight() - parseFloat(style.getPropertyValue('--bottom-sheet-clearance'))
    const height = aboveSheet - (boardEl.getBoundingClientRect().top + window.scrollY)
    // The flat board's box is as tall as BOARD_SIZE at BASE_HEX_RADIUS.
    gridStore.fitMobileBoard(
      Math.min(width / ctx.flatWidthInRadii, height / (BOARD_SIZE / BASE_HEX_RADIUS)),
    )
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
    window.addEventListener('resize', scheduleFit)
  })

  onUnmounted(() => {
    cancelAnimationFrame(frame)
    observer?.disconnect()
    window.removeEventListener('resize', scheduleFit)
    gridStore.fitMobileBoard(null)
  })
}
