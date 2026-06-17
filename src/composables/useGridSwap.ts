/* Grid-swap interaction state for the 5 v 5 boards.
 *
 * Drives the per-board "swap" affordance: arming a source board, then choosing a
 * target to exchange their rosters via grids.swapBoards. State is a module-level
 * singleton (like useDragDrop) since at most one swap is in flight and the
 * document listeners must share identity across the boards that add/remove them.
 *
 * Two ways to pick a target, sharing one armed-source state:
 *  - Click: press the swap button to arm; each board renders an overlay, and a
 *    click on another board's overlay swaps. Clicking the source overlay or
 *    anywhere outside the boards cancels.
 *  - Desktop drag: press-and-drag the swap button, drop over another board. A
 *    press that never crosses the drag threshold stays armed for the click flow.
 */

import { computed, ref } from 'vue'

import { useGrids } from '@/stores/grids'

// Pointer travel (px) before a button press is treated as a drag rather than a click.
const DRAG_THRESHOLD = 6

const sourceId = ref<number | null>(null)
const dragging = ref(false)
const dragPosition = ref({ x: 0, y: 0 })

// Pointer-gesture bookkeeping for the active press (non-reactive).
let pressStart: { x: number; y: number } | null = null
let allowDrag = false

const isSwapping = computed(() => sourceId.value !== null)

const boardIdFromPoint = (x: number, y: number): number | null => {
  if (import.meta.env.SSR) return null
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-grid-board-id]')
  if (!el) return null
  const id = Number(el.dataset.gridBoardId)
  return Number.isNaN(id) ? null : id
}

const detachDragListeners = (): void => {
  if (import.meta.env.SSR) return
  document.removeEventListener('pointermove', onPointerMove)
  document.removeEventListener('pointerup', onPointerUp)
}

// Tear down all swap state and listeners; safe to call from any exit path.
const reset = (): void => {
  sourceId.value = null
  dragging.value = false
  pressStart = null
  allowDrag = false
  if (!import.meta.env.SSR) document.removeEventListener('pointerdown', onOutsidePointerDown)
  detachDragListeners()
}

const arm = (boardId: number): void => {
  sourceId.value = boardId
  dragging.value = false
  // Bubble phase: overlays/buttons stopPropagation, so this only fires for a
  // press that lands outside every board, which cancels the swap.
  if (!import.meta.env.SSR) document.addEventListener('pointerdown', onOutsidePointerDown)
}

// Resolve a chosen target: swap when it differs from the source, otherwise (the
// source itself) just cancel. Always exits the swap state first.
const swapInto = (targetId: number): void => {
  const src = sourceId.value
  reset()
  if (src !== null && targetId !== src) useGrids().swapBoards(src, targetId)
}

function onOutsidePointerDown(): void {
  reset()
}

function onPointerMove(event: PointerEvent): void {
  if (!allowDrag || pressStart === null) return
  if (!dragging.value) {
    const dx = event.clientX - pressStart.x
    const dy = event.clientY - pressStart.y
    if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return
    dragging.value = true
  }
  dragPosition.value = { x: event.clientX, y: event.clientY }
}

function onPointerUp(event: PointerEvent): void {
  detachDragListeners()
  if (!dragging.value) {
    // A press with no drag: leave the source armed for the click-to-target flow.
    pressStart = null
    return
  }
  const targetId = boardIdFromPoint(event.clientX, event.clientY)
  if (targetId !== null) swapInto(targetId)
  else reset()
}

export function useGridSwap() {
  // Begin a swap from a board's swap button. Re-pressing the armed board's own
  // button reads as "click the original grid" and cancels. `draggable` gates the
  // desktop drag (off on the touch/sheet layout).
  const startFromButton = (boardId: number, event: PointerEvent, draggable: boolean): void => {
    if (event.button !== 0) return // primary button only
    event.stopPropagation()
    if (sourceId.value === boardId) {
      reset()
      return
    }
    arm(boardId)
    allowDrag = draggable
    pressStart = { x: event.clientX, y: event.clientY }
    if (draggable && !import.meta.env.SSR) {
      document.addEventListener('pointermove', onPointerMove)
      document.addEventListener('pointerup', onPointerUp)
    }
  }

  return {
    sourceId,
    isSwapping,
    dragging,
    dragPosition,
    startFromButton,
    selectTarget: swapInto,
    cancel: reset,
  }
}
