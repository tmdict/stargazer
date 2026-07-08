/* Modern browsers dispatch click as a PointerEvent; older engines send a plain
 * MouseEvent with no pointerType, which reads as a mouse gesture — the safe
 * fallback, since mouse keeps the long-standing behavior. */
export function isTouchClick(event: Event): boolean {
  if (!('pointerType' in event)) return false
  const type = (event as PointerEvent).pointerType
  return type === 'touch' || type === 'pen'
}
