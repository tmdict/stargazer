/* Tells a click handler which input produced the click. The click event's own
 * pointerType is not trustworthy: Safari before 18.2 synthesizes tap clicks as
 * plain MouseEvents (no pointerType), and Safari 18.2-18.3 stamps them
 * pointerType "mouse" (WebKit bug, fixed in 18.4), so both would make every
 * tap read as a mouse. The pointerdown/pointerup press that caused the click
 * carries the real type on every engine, so record it document-wide and let
 * the recent press outrank the click's own claim; a genuine mouse click emits
 * its own mouse press just before the click, so it still reads as mouse. A
 * click with no recent press and no own type reads as mouse, the safe fallback
 * since every layout supports the mouse flow. */

// A synthesized click can trail its press (iOS tap-delay heuristics), but a
// press from longer ago than this cannot be the click's cause.
const PRESS_CLICK_WINDOW_MS = 800

let lastPressType = ''
let lastPressAt = 0

// Capture phase so no stopPropagation can starve the record; pointerup fires
// immediately before the click it produces, so long presses stay in-window.
if (typeof document !== 'undefined') {
  const recordPress = (e: Event) => {
    const type = (e as PointerEvent).pointerType
    if (type) {
      lastPressType = type
      lastPressAt = performance.now()
    }
  }
  document.addEventListener('pointerdown', recordPress, true)
  document.addEventListener('pointerup', recordPress, true)
}

export function isTouchClick(event: Event): boolean {
  const pressIsRecent = performance.now() - lastPressAt <= PRESS_CLICK_WINDOW_MS
  const type =
    pressIsRecent && lastPressType
      ? lastPressType
      : ((event as Partial<PointerEvent>).pointerType ?? '')
  return type === 'touch' || type === 'pen'
}
