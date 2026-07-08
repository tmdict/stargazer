import { onMounted, onUnmounted, watch, type Ref } from 'vue'

interface UseOverlayOptions {
  elementRef: Ref<HTMLElement | undefined | null>
  onClose: () => void
  /** Omit when the component mounts only while open (e.g. CharacterSelectionPopup).
   * Provide when it stays mounted across open/closed transitions
   * (e.g. BaseModal); handlers no-op while `false`. */
  isOpen?: Ref<boolean>
  clickOutsideDelay?: number
}

const DEFAULT_DELAY_MS = 50

/**
 * Escape-to-close + click-outside-to-close for modal-style surfaces.
 *
 * The click-outside listener is re-armed (with a small delay) on every
 * false→true transition of `isOpen`. The opening click (e.g. on a sibling
 * "info" button) keeps bubbling up to the document-level listener in the
 * same event, and Vue's prop propagation across parent→child can race that
 * bubble. Without the delay the panel can close itself on the click that
 * opened it. The delay defers attachment past the open-click rather than
 * depending on microtask scheduling we can't reliably observe.
 */
export function useOverlay({
  elementRef,
  onClose,
  isOpen,
  clickOutsideDelay = DEFAULT_DELAY_MS,
}: UseOverlayOptions): void {
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return
    if (isOpen && !isOpen.value) return
    onClose()
  }

  // A click target detached mid-bubble (a pick removing itself from a list, a
  // hero removed by the click) can't be attributed by contains(), so record
  // where the press started on capture, before any handler can detach it, and
  // attribute the click to that.
  let pressStartedInside = false

  const handlePointerDown = (e: PointerEvent) => {
    const el = elementRef.value
    pressStartedInside = !!el && e.target instanceof Node && el.contains(e.target)
  }

  const handleClickOutside = (e: MouseEvent) => {
    if (isOpen && !isOpen.value) return
    const el = elementRef.value
    if (!el || !(e.target instanceof Node)) return
    if (e.target.isConnected ? el.contains(e.target) : pressStartedInside) return
    onClose()
  }

  let pendingTimer: ReturnType<typeof setTimeout> | null = null
  let clickAttached = false

  const attachClick = () => {
    pendingTimer = null
    if (clickAttached) return
    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('click', handleClickOutside)
    clickAttached = true
  }

  const detachClick = () => {
    if (pendingTimer) {
      clearTimeout(pendingTimer)
      pendingTimer = null
    }
    if (clickAttached) {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('click', handleClickOutside)
      clickAttached = false
    }
  }

  const armClick = () => {
    detachClick()
    if (clickOutsideDelay > 0) {
      pendingTimer = setTimeout(attachClick, clickOutsideDelay)
    } else {
      attachClick()
    }
  }

  onMounted(() => {
    document.addEventListener('keydown', handleEscape)
    if (isOpen) {
      watch(
        isOpen,
        (open) => {
          if (open) armClick()
          else detachClick()
        },
        { immediate: true },
      )
    } else {
      armClick()
    }
  })

  onUnmounted(() => {
    document.removeEventListener('keydown', handleEscape)
    detachClick()
  })
}
