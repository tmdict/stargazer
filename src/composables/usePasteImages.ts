import { onMounted, onUnmounted } from 'vue'

import { imageFilesFromPaste } from '@/utils/imageFile'

/* Images pasted anywhere on the page, while `active`. The listener is on the
 * window, so a paste needs no focus; `active` keeps a paste from feeding a
 * part that is mounted but not showing (a closed modal, a hidden tab). */
export function usePasteImages(active: () => boolean, onFiles: (files: File[]) => void): void {
  const handlePaste = (event: ClipboardEvent): void => {
    if (!active()) return
    const files = imageFilesFromPaste(event)
    if (!files.length) return
    event.preventDefault()
    onFiles(files)
  }

  onMounted(() => window.addEventListener('paste', handlePaste))
  onUnmounted(() => window.removeEventListener('paste', handlePaste))
}
