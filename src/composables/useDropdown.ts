import { onMounted, onUnmounted, readonly, ref, type Ref } from 'vue'

import { useOverlay } from './useOverlay'
import { useTouchDetection } from './useTouchDetection'

/* Open state for a dropdown whose root element wraps both the trigger and the
 * panel, so the trigger's own click never counts as an outside click.
 *
 * - Outside clicks close it (useOverlay).
 * - Escape closes only the dropdown: the capture-phase handler stops the key
 *   before bubble-phase handlers (a surrounding modal or popup) see it.
 * - `hover` opens it for mouse pointers. Touch is excluded, as in
 *   useHoverTooltip: a tap fires a synthetic mouseenter whose hover-open the
 *   tap's own click toggle would immediately undo. Leaving waits a grace period
 *   so the cursor can cross the gap between the trigger and the panel.
 *
 * Bind the three pointer handlers on the root element (touchstart passive). */

const HOVER_CLOSE_GRACE_MS = 150

export function useDropdown({
  rootRef,
  hover = false,
  onClose,
}: {
  rootRef: Ref<HTMLElement | undefined | null>
  hover?: boolean
  // Runs whenever an open dropdown closes, whatever closed it.
  onClose?: () => void
}) {
  const open = ref(false)
  let closeTimer: ReturnType<typeof setTimeout> | undefined

  const show = (): void => {
    clearTimeout(closeTimer)
    open.value = true
  }

  const hide = (): void => {
    clearTimeout(closeTimer)
    if (!open.value) return
    open.value = false
    onClose?.()
  }

  const toggle = (): void => (open.value ? hide() : show())

  const { isTouchDevice } = useTouchDetection()
  const interactionStartedAsTouch = ref(false)

  const onMouseEnter = (): void => {
    if (!hover || isTouchDevice.value || interactionStartedAsTouch.value) return
    show()
  }
  const onMouseLeave = (): void => {
    interactionStartedAsTouch.value = false
    if (!hover || isTouchDevice.value) return
    clearTimeout(closeTimer)
    closeTimer = setTimeout(hide, HOVER_CLOSE_GRACE_MS)
  }
  const onTouchStart = (): void => {
    interactionStartedAsTouch.value = true
  }

  useOverlay({ elementRef: rootRef, isOpen: open, onClose: hide })

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape' || !open.value) return
    e.stopPropagation()
    hide()
  }
  onMounted(() => document.addEventListener('keydown', onKeyDown, { capture: true }))
  onUnmounted(() => {
    document.removeEventListener('keydown', onKeyDown, { capture: true })
    clearTimeout(closeTimer)
  })

  return { open: readonly(open), show, hide, toggle, onMouseEnter, onMouseLeave, onTouchStart }
}
