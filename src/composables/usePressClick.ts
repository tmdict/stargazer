import { ref } from 'vue'

// A press shorter than this is a click; anything longer is treated as a drag
const CLICK_THRESHOLD_MS = 200

/**
 * Distinguishes a click from a drag by press duration: HTML5 drags fire
 * mousedown/mouseup around the drag, so a plain click handler would also
 * fire after every drag. Bind `onMouseDown`/`onMouseUp` to the element;
 * `onMouseUp` forwards its arguments to the click callback.
 */
export function usePressClick<T extends unknown[]>(onClick: (...args: T) => void) {
  const pressStart = ref<number | null>(null)

  const onMouseDown = () => {
    pressStart.value = Date.now()
  }

  const onMouseUp = (...args: T) => {
    if (pressStart.value === null) return
    const duration = Date.now() - pressStart.value
    pressStart.value = null
    if (duration < CLICK_THRESHOLD_MS) onClick(...args)
  }

  return { onMouseDown, onMouseUp }
}
