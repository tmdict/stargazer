import { ref } from 'vue'

/**
 * Detects whether the user is using touch or mouse input — drives whether to
 * show hover tooltips (mouse) or suppress them (touch).
 *
 * State and listeners are module-level singletons: input modality is a
 * device-global fact, and this composable is called by every roster icon —
 * per-instance document listeners would pile up hundreds of identical
 * handlers. The listeners live for the app's lifetime.
 */
const isTouchDevice = ref(false)
const hasTouched = ref(false)

const handleTouchStart = () => {
  isTouchDevice.value = true
  hasTouched.value = true
}

// Only mark as mouse device if we haven't seen touch events — handles devices
// with both touch and mouse (like laptops with touchscreens)
const handleMouseMove = () => {
  if (!hasTouched.value) {
    isTouchDevice.value = false
  }
}

const handleMouseEnter = () => {
  if (!hasTouched.value) {
    isTouchDevice.value = false
  }
}

let listenersAttached = false

export function useTouchDetection() {
  if (!listenersAttached && !import.meta.env.SSR) {
    listenersAttached = true
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      document.addEventListener('touchstart', handleTouchStart, { passive: true })
    }
    document.addEventListener('mousemove', handleMouseMove, { passive: true })
    document.addEventListener('mouseenter', handleMouseEnter, { passive: true })
  }

  return {
    isTouchDevice,
    hasTouched,
  }
}
