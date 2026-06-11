import { ref } from 'vue'

import { useTouchDetection } from './useTouchDetection'

/**
 * Hover-tooltip visibility with touch suppression: mouse hover shows the
 * tooltip, but not on touch devices or when the interaction started as a
 * touch (a mobile tap fires a synthetic mouseenter right after touchstart).
 */
export function useHoverTooltip() {
  const { isTouchDevice } = useTouchDetection()
  const showTooltip = ref(false)
  const interactionStartedAsTouch = ref(false)

  const onMouseEnter = () => {
    if (!isTouchDevice.value && !interactionStartedAsTouch.value) {
      showTooltip.value = true
    }
  }

  const onMouseLeave = () => {
    showTooltip.value = false
    interactionStartedAsTouch.value = false // Reset for next interaction
  }

  const onTouchStart = () => {
    interactionStartedAsTouch.value = true
    showTooltip.value = false
  }

  return { showTooltip, onMouseEnter, onMouseLeave, onTouchStart }
}
