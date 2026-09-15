import { nextTick, watch, type Ref } from 'vue'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Keyboard focus for a dialog surface that stays mounted across open/close.
 * On open, focus moves onto the surface itself (it needs `tabindex="-1"`), so
 * assistive tech announces the dialog and reading starts at its top; the
 * returned `trapTab`, bound to the surface's keydown, keeps Tab and Shift+Tab
 * cycling inside it; on close, focus returns to the element that opened it.
 * Clicks on non-focusable content inside the surface focus the surface, so
 * focus never drifts behind the dialog. Escape is the overlay's concern.
 */
export function useFocusTrap(surface: Ref<HTMLElement | undefined>, isOpen: Ref<boolean>) {
  let opener: HTMLElement | null = null

  watch(isOpen, (open) => {
    if (open) {
      opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
      // The surface renders on the tick after `isOpen` flips.
      void nextTick(() => surface.value?.focus())
    } else {
      if (opener?.isConnected) opener.focus()
      opener = null
    }
  })

  const trapTab = (e: KeyboardEvent): void => {
    const el = surface.value
    if (e.key !== 'Tab' || !el) return
    const focusable = el.querySelectorAll<HTMLElement>(FOCUSABLE)
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (!first || !last) {
      e.preventDefault()
      return
    }
    const active = document.activeElement
    if (e.shiftKey && (active === first || active === el)) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && active === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return { trapTab }
}
