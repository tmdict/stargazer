/* The drag of an Honor Duel piece from the list onto a unit on the board. It
 * rides the native HTML5 pipeline under a MIME type of its own, so the hero
 * drop pipeline never reads it.
 *
 * The board acts on a drag outside its own drag events: a unit's highlight
 * ends with the drag, and while it lasts only portraits take the pointer. So
 * whether a piece is in flight is kept here: module-level, as at most one
 * drag exists at a time. */

import { readonly, ref } from 'vue'

const DUEL_PIECE_MIME = 'application/duel-equipment'

const dragging = ref(false)

const release = (): void => {
  dragging.value = false
}

const start = (event: DragEvent, piece: number): void => {
  if (!event.dataTransfer) return
  event.dataTransfer.setData(DUEL_PIECE_MIME, String(piece))
  event.dataTransfer.effectAllowed = 'copy'
  dragging.value = true
  // dragend bubbles here from the list, wherever the piece is let go.
  document.addEventListener('dragend', release, { once: true })
}

const carriesPiece = (event: DragEvent): boolean =>
  event.dataTransfer?.types.includes(DUEL_PIECE_MIME) ?? false

// The piece a drop carries, or null for any other drag.
const droppedPiece = (event: DragEvent): number | null => {
  const id = event.dataTransfer?.getData(DUEL_PIECE_MIME)
  return id ? Number(id) : null
}

export const useDuelPieceDrag = () => ({
  isDraggingPiece: readonly(dragging),
  start,
  carriesPiece,
  droppedPiece,
})
