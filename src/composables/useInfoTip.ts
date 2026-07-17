import { onMounted, onUnmounted, ref, type Ref } from 'vue'

import { useTouchDetection } from './useTouchDetection'

/**
 * Info tooltip for triggers whose only job is revealing information: hover
 * shows it while the mouse rests on the trigger, and click or tap shows the
 * same tooltip, which is the whole touch path (the synthetic mouseenter a tap
 * fires is suppressed via useHoverTooltip's guards). A second click of the
 * trigger, a press outside it, or Escape dismisses it; hovering another
 * trigger simply replaces it, like any hover.
 *
 * Keyboard: on a natively focusable trigger (a real button), wire focus/blur
 * to hoverOpen/hoverClose; Enter and Space then toggle through the native
 * click.
 *
 * Short icon labels (Copy, Rename, nav links) stay on native `title`: those
 * are hover-only and touch-silent already, which is all Rule B asks. The
 * tooltip composables are for sentence-length content and shared popups.
 *
 * Handlers take the trigger element from the event's currentTarget; delegated
 * callers (SkillKeywordTooltip, whose spans live in v-html) pass the resolved
 * element directly.
 */
export function useInfoTip<T = true>() {
  const { isTouchDevice } = useTouchDetection()
  const interactionStartedAsTouch = ref(false)

  const anchor: Ref<Element | null> = ref(null)
  const payload = ref(null) as Ref<T | null>

  const elOf = (src: Event | Element): Element | null =>
    src instanceof Element ? src : src.currentTarget instanceof Element ? src.currentTarget : null

  const open = (el: Element, value: T): void => {
    anchor.value = el
    payload.value = value
  }

  const close = (): void => {
    anchor.value = null
    payload.value = null
  }

  const hoverOpen = (src: Event | Element, value: T = true as T): void => {
    if (isTouchDevice.value || interactionStartedAsTouch.value) return
    const el = elOf(src)
    if (el) open(el, value)
  }

  const hoverClose = (): void => {
    interactionStartedAsTouch.value = false
    close()
  }

  const toggle = (src: Event | Element, value: T = true as T): void => {
    const el = elOf(src)
    if (!el) return
    if (el === anchor.value) close()
    else open(el, value)
  }

  const onTouchStart = (): void => {
    interactionStartedAsTouch.value = true
  }

  // A press outside the anchored trigger dismisses; a press on the trigger
  // itself is left for toggle, which owns that case.
  const onDocPointerDown = (e: PointerEvent): void => {
    if (!anchor.value) return
    if (e.target instanceof Node && anchor.value.contains(e.target)) return
    close()
  }

  // Capture phase so a modal's own Escape handler (which may stop
  // propagation) can't starve the close; the key itself is let through.
  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape' || !anchor.value) return
    close()
  }

  onMounted(() => {
    document.addEventListener('pointerdown', onDocPointerDown)
    document.addEventListener('keydown', onKeyDown, { capture: true })
  })

  onUnmounted(() => {
    document.removeEventListener('pointerdown', onDocPointerDown)
    document.removeEventListener('keydown', onKeyDown, { capture: true })
  })

  return { anchor, payload, hoverOpen, hoverClose, toggle, onTouchStart, close }
}
