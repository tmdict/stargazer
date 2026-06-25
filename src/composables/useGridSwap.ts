/* Grid-swap interaction state for the 5 v 5 boards.
 *
 * Drives the per-board "swap" affordance: arming a source board, then choosing a
 * target to exchange their rosters via grids.swapBoards. State is a module-level
 * singleton (like useDragDrop) since at most one swap is in flight and the document
 * listeners must share identity across the boards that add/remove them.
 *
 * Three ways to pick a target, sharing one armed-source state:
 *  - Desktop drag: press-and-drag the swap button, drop over another board.
 *  - Desktop click: arm via the button, then click another board's overlay to swap.
 *  - Tap layout (sheet): arm, then tap a board to preview it (highlight + label) and
 *    tap it again to confirm. A board tap registers only on release without travel,
 *    so swiping between boards in the horizontal row never selects or cancels, and the
 *    two-step keeps a far board from committing on the first touch.
 */

import { computed, ref } from 'vue'

import { useGrids } from '@/stores/grids'

// Pointer travel (px) before a button press is treated as a drag rather than a click.
const DRAG_THRESHOLD = 6
// Pointer travel (px) under which an overlay press counts as a tap rather than a swipe.
const TAP_MOVE_MAX = 10

const sourceId = ref<number | null>(null)
// Target previewed in the tap layout, awaiting a confirming second tap.
const pendingId = ref<number | null>(null)
const dragging = ref(false)
const dragPosition = ref({ x: 0, y: 0 })

// Pointer-gesture bookkeeping for the active press (non-reactive).
let pressStart: { x: number; y: number } | null = null
let allowDrag = false
// Whether picking a target takes a confirming second tap (the tap/sheet layout).
let twoStep = false
// The overlay press in progress, to tell a tap from a swipe on release.
let overlayPress: { boardId: number; x: number; y: number } | null = null

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
  pendingId.value = null
  dragging.value = false
  pressStart = null
  overlayPress = null
  allowDrag = false
  twoStep = false
  if (!import.meta.env.SSR) document.removeEventListener('pointerdown', onOutsidePointerDown)
  detachDragListeners()
}

const arm = (boardId: number, confirmTap: boolean): void => {
  sourceId.value = boardId
  pendingId.value = null
  dragging.value = false
  twoStep = confirmTap
  // Bubble phase: overlays stopPropagation, so this only fires for a press that lands
  // outside every board, which cancels the swap.
  if (!import.meta.env.SSR) document.addEventListener('pointerdown', onOutsidePointerDown)
}

// Resolve a chosen target: swap when it differs from the source, otherwise (the
// source itself) just cancel. Always exits the swap state first.
const swapInto = (targetId: number): void => {
  const src = sourceId.value
  reset()
  if (src !== null && targetId !== src) useGrids().swapBoards(src, targetId)
}

// The source cancels; another board is the target. With a drag/mouse the first tap
// commits; on the tap layout the first tap previews, a second tap on the same board
// confirms, and tapping a different board moves the preview.
const tapBoard = (boardId: number): void => {
  if (sourceId.value === null) return
  if (boardId === sourceId.value) {
    reset()
    return
  }
  if (!twoStep || pendingId.value === boardId) {
    swapInto(boardId)
    return
  }
  pendingId.value = boardId
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
    // A press with no drag: leave the source armed for the click/tap-to-target flow.
    pressStart = null
    return
  }
  const targetId = boardIdFromPoint(event.clientX, event.clientY)
  if (targetId !== null) swapInto(targetId)
  else reset()
}

// A board overlay records the press only when it lands on the overlay itself, so the
// press that armed the swap (on the button, before the overlay existed) is ignored.
const onOverlayDown = (boardId: number, event: PointerEvent): void => {
  overlayPress = { boardId, x: event.clientX, y: event.clientY }
}

// Release resolves a target only as a tap: same board, under the travel limit. A
// swipe to scroll the row exceeds it (or is replaced by pointercancel) and is dropped.
const onOverlayUp = (boardId: number, event: PointerEvent): void => {
  const press = overlayPress
  overlayPress = null
  if (!press || press.boardId !== boardId) return
  if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > TAP_MOVE_MAX) return
  tapBoard(boardId)
}

const clearOverlayPress = (): void => {
  overlayPress = null
}

export function useGridSwap() {
  // Begin a swap from a board's swap button. Re-pressing the armed board's own button
  // reads as "tap the original grid" and cancels. `draggable` gates the desktop drag
  // (off on the tap/sheet layout, where a confirming second tap replaces it).
  const startFromButton = (boardId: number, event: PointerEvent, draggable: boolean): void => {
    if (event.button !== 0) return // primary button only
    event.stopPropagation()
    if (sourceId.value === boardId) {
      reset()
      return
    }
    arm(boardId, !draggable)
    allowDrag = draggable
    pressStart = { x: event.clientX, y: event.clientY }
    if (draggable && !import.meta.env.SSR) {
      document.addEventListener('pointermove', onPointerMove)
      document.addEventListener('pointerup', onPointerUp)
    }
  }

  return {
    sourceId,
    pendingId,
    isSwapping,
    dragging,
    dragPosition,
    startFromButton,
    onOverlayDown,
    onOverlayUp,
    clearOverlayPress,
    cancel: reset,
  }
}
