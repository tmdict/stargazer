/* Modern browsers dispatch click as a PointerEvent; an engine that sends a
 * plain MouseEvent has no pointerType and reads as a mouse gesture, the safe
 * fallback since every layout supports the mouse flow. */
export function isTouchClick(event: Event): boolean {
  if (!('pointerType' in event)) return false
  const type = (event as PointerEvent).pointerType
  return type === 'touch' || type === 'pen'
}
