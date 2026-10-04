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
 * - A panel teleported out of the root is passed as `panelRef`, so a click in
 *   it is not an outside click, and binds the two mouse handlers itself: the
 *   root does not hear the pointer while it is over the panel.
 * - Hover opens one dropdown at a time. A second one closes the first at once:
 *   left to its grace period, it would overlap the new panel of a neighbor.
 *   A dropdown a click opened stays until a click closes it.
 *
 * Bind the three pointer handlers on the root element (touchstart passive). */

const HOVER_CLOSE_GRACE_MS = 150

const openDropdowns = new Set<() => void>()
let closeHoverOpened: (() => void) | null = null

/* Closes every open dropdown. For a surface that takes the screen with no
 * click outside them: a popup opened by a long press, a sheet sliding away. */
export function closeDropdowns(): void {
  for (const hide of [...openDropdowns]) hide()
}

export function useDropdown({
  rootRef,
  panelRef,
  hover = false,
  onClose,
}: {
  rootRef: Ref<HTMLElement | undefined | null>
  panelRef?: Ref<HTMLElement | undefined | null>
  hover?: boolean
  // Runs whenever an open dropdown closes, whatever closed it.
  onClose?: () => void
}) {
  const open = ref(false)
  let closeTimer: ReturnType<typeof setTimeout> | undefined

  const hide = (): void => {
    clearTimeout(closeTimer)
    if (!open.value) return
    open.value = false
    forget()
    onClose?.()
  }

  const forget = (): void => {
    openDropdowns.delete(hide)
    if (closeHoverOpened === hide) closeHoverOpened = null
  }

  const show = (): void => {
    clearTimeout(closeTimer)
    open.value = true
    openDropdowns.add(hide)
  }

  const toggle = (): void => (open.value ? hide() : show())

  const { isTouchDevice } = useTouchDetection()
  const interactionStartedAsTouch = ref(false)

  const onMouseEnter = (): void => {
    if (!hover || isTouchDevice.value || interactionStartedAsTouch.value) return
    if (!open.value) {
      closeHoverOpened?.()
      closeHoverOpened = hide
    }
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

  useOverlay({ elementRef: rootRef, detachedRef: panelRef, isOpen: open, onClose: hide })

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape' || !open.value) return
    e.stopPropagation()
    hide()
  }
  onMounted(() => document.addEventListener('keydown', onKeyDown, { capture: true }))
  onUnmounted(() => {
    document.removeEventListener('keydown', onKeyDown, { capture: true })
    clearTimeout(closeTimer)
    forget()
  })

  return { open: readonly(open), show, hide, toggle, onMouseEnter, onMouseLeave, onTouchStart }
}
