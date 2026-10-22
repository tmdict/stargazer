/* Closing a popup an import review opens over a screenshot's board: Escape, or
 * a click anywhere outside it, closes it. Both are heard on capture, since the
 * import modal stops clicks before they reach the document and would close
 * itself, with every shot, on Escape. A click on what opens a popup
 * (`data-board-popup-opener`) is left to it, so it can open, move or close the
 * popup itself; the popup's own root carries `data-board-popup`. */

import { onMounted, onUnmounted } from 'vue'

export function useBoardPopup(isOpen: () => boolean, close: () => void): void {
  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || !isOpen()) return
    event.stopPropagation()
    close()
  }
  const onClick = (event: MouseEvent): void => {
    if (!isOpen()) return
    const target = event.target as Element | null
    if (target?.closest('[data-board-popup], [data-board-popup-opener]')) return
    close()
  }
  onMounted(() => {
    document.addEventListener('keydown', onKeydown, { capture: true })
    document.addEventListener('click', onClick, { capture: true })
  })
  onUnmounted(() => {
    document.removeEventListener('keydown', onKeydown, { capture: true })
    document.removeEventListener('click', onClick, { capture: true })
  })
}
