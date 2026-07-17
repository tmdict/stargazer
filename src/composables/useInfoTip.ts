import { onMounted, onUnmounted, ref, type Ref } from 'vue'

import { useTouchDetection } from './useTouchDetection'

/**
 * Pinnable info tooltip (a "toggletip"), for triggers whose only job is
 * revealing information: hover shows it while the mouse rests on the trigger,
 * click or tap pins it, and an outside press, Escape, or a second click of
 * the pinned trigger dismisses it. The synthetic mouseenter a tap fires is
 * suppressed (useHoverTooltip's guards), leaving click as the single touch
 * path. Escape is consumed in the capture phase so a pinned tip inside a
 * modal closes without taking the modal down with it.
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
  const pinned = ref(false)

  const elOf = (src: Event | Element): Element | null =>
    src instanceof Element ? src : src.currentTarget instanceof Element ? src.currentTarget : null

  const open = (el: Element, value: T, pin: boolean): void => {
    anchor.value = el
    payload.value = value
    pinned.value = pin
  }

  const close = (): void => {
    anchor.value = null
    payload.value = null
    pinned.value = false
  }

  const hoverOpen = (src: Event | Element, value: T = true as T): void => {
    if (isTouchDevice.value || interactionStartedAsTouch.value) return
    const el = elOf(src)
    // Re-entering the anchored trigger must not downgrade a pin.
    if (!el || el === anchor.value) return
    open(el, value, false)
  }

  const hoverClose = (): void => {
    interactionStartedAsTouch.value = false
    if (!pinned.value) close()
  }

  const toggle = (src: Event | Element, value: T = true as T): void => {
    const el = elOf(src)
    if (!el) return
    if (pinned.value && el === anchor.value) close()
    else open(el, value, true)
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

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape' || !anchor.value) return
    e.stopPropagation()
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

  return { anchor, payload, pinned, hoverOpen, hoverClose, toggle, onTouchStart, close }
}
