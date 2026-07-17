import { ref, type Ref } from 'vue'

import { useTouchDetection } from './useTouchDetection'

/**
 * Hover-tooltip visibility with touch suppression: mouse hover shows the
 * tooltip, but not on touch devices or when the interaction started as a
 * touch (a mobile tap fires a synthetic mouseenter right after touchstart).
 *
 * This is the contract for ACTION triggers (buttons, icons that do something
 * when tapped): touch users get the action, never the tooltip. Info-only
 * triggers use useInfoTip instead, which adds tap-to-pin.
 *
 * `anchor`/`payload` track the hovered trigger and its datum for components
 * where several triggers share one teleported TooltipPopup; single-trigger
 * callers can ignore them and read `showTooltip` alone.
 */
export function useHoverTooltip<T = true>() {
  const { isTouchDevice } = useTouchDetection()
  const showTooltip = ref(false)
  const anchor: Ref<Element | null> = ref(null)
  const payload = ref(null) as Ref<T | null>
  const interactionStartedAsTouch = ref(false)

  const onMouseEnter = (event?: Event, value: T = true as T) => {
    if (isTouchDevice.value || interactionStartedAsTouch.value) return
    showTooltip.value = true
    anchor.value = event?.currentTarget instanceof Element ? event.currentTarget : null
    payload.value = value
  }

  const onMouseLeave = () => {
    showTooltip.value = false
    anchor.value = null
    payload.value = null
    interactionStartedAsTouch.value = false // Reset for next interaction
  }

  const onTouchStart = () => {
    interactionStartedAsTouch.value = true
    showTooltip.value = false
  }

  return { showTooltip, anchor, payload, onMouseEnter, onMouseLeave, onTouchStart }
}
