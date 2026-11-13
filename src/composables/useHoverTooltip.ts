import { ref, type Ref } from 'vue'

import { isTouchHover } from '@/utils/pointer'

/**
 * Hover-tooltip visibility with touch suppression: mouse hover shows the
 * tooltip, but the synthetic mouseenter a tap fires does not.
 *
 * This is the contract for ACTION triggers (buttons, icons that do something
 * when tapped): touch users get the action, never the tooltip. Info-only
 * triggers use useInfoTip instead, where a tap shows the tooltip.
 *
 * `anchor`/`payload` track the hovered trigger and its datum for components
 * where several triggers share one teleported TooltipPopup; single-trigger
 * callers can ignore them and read `showTooltip` alone.
 */
export function useHoverTooltip<T = true>() {
  const showTooltip = ref(false)
  const anchor: Ref<Element | null> = ref(null)
  const payload = ref(null) as Ref<T | null>

  const onMouseEnter = (event?: Event, value: T = true as T) => {
    if (isTouchHover()) return
    showTooltip.value = true
    anchor.value = event?.currentTarget instanceof Element ? event.currentTarget : null
    payload.value = value
  }

  const onMouseLeave = () => {
    showTooltip.value = false
    anchor.value = null
    payload.value = null
  }

  return { showTooltip, anchor, payload, onMouseEnter, onMouseLeave }
}
