import { onMounted, onUnmounted, ref } from 'vue'

/**
 * Composable for detecting whether the user is using touch or mouse input
 * This helps determine whether to show tooltips (mouse) or not (touch)
 */
export function useTouchDetection() {
  // Track if the last interaction was touch
  const isTouchDevice = ref(false)

  // Track if user has touched at least once
  const hasTouched = ref(false)

  const handleTouchStart = () => {
    isTouchDevice.value = true
    hasTouched.value = true
  }

  const handleMouseMove = () => {
    // Only mark as mouse device if we haven't seen touch events
    // This handles devices with both touch and mouse (like laptops with touchscreens)
    if (!hasTouched.value) {
      isTouchDevice.value = false
    }
  }

  const handleMouseEnter = () => {
    // If a mouse enter happens without prior touch, it's likely a mouse
    if (!hasTouched.value) {
      isTouchDevice.value = false
    }
  }

  onMounted(() => {
    // Check if device supports touch
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      // Device supports touch, but we'll wait to see what input method is actually used
      document.addEventListener('touchstart', handleTouchStart, { passive: true })
    }

    // Listen for mouse events
    document.addEventListener('mousemove', handleMouseMove, { passive: true })
    document.addEventListener('mouseenter', handleMouseEnter, { passive: true })
  })

  onUnmounted(() => {
    document.removeEventListener('touchstart', handleTouchStart)
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseenter', handleMouseEnter)
  })

  return {
    isTouchDevice,
    hasTouched,
  }
}
