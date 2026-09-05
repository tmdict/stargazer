/* Page-global armed-attr-layer selection for the edit docks: which upgrade
 * layers (paragon / refinement) portrait taps and bulk actions edit. State is
 * a module-level singleton (like useSelectionState / useDragDrop) so every
 * board's dock and panel share one selection — a chip toggled on any dock
 * flips them all. Unlike useSelectionState it references no boards or hexes,
 * so it needs no route-change or rebuild reset; session-only by design.
 *
 * The selection is a set, not an enum (both layers armed = edit both), with
 * two guards: the last armed layer can't be disarmed, and the *effective*
 * layers are the armed set intersected with the pref-visible layers — a
 * hidden layer must never be silently edited. When the intersection is
 * empty, the visible layers act as armed (so taps keep working when the
 * armed layer's pref is toggled off); with nothing visible, editing no-ops.
 */

import { reactive } from 'vue'

import { ATTR_PARAGON } from '@/lib/characters/attributes'

const armed = reactive(new Set<number>([ATTR_PARAGON]))

export function useAttrLayerSelection(): {
  isArmed: (attrId: number) => boolean
  toggle: (attrId: number, visible: number[]) => void
  effectiveLayers: (visible: number[]) => number[]
} {
  const isArmed = (attrId: number): boolean => armed.has(attrId)

  // Clicks act on the effective (displayed) set, not the raw armed set: with
  // a pref toggled off the two can diverge, and toggling raw state behind a
  // fallback-lit chip would visibly do nothing while arming hidden layers.
  // The click's result replaces the whole set, so what the chips show is
  // exactly what is armed afterward.
  const toggle = (attrId: number, visible: number[]): void => {
    const effective = effectiveLayers(visible)
    const next = effective.includes(attrId)
      ? effective.length > 1
        ? effective.filter((id) => id !== attrId)
        : effective
      : [...effective, attrId]
    armed.clear()
    for (const id of next) armed.add(id)
  }

  const effectiveLayers = (visible: number[]): number[] => {
    const intersection = visible.filter((attrId) => armed.has(attrId))
    return intersection.length > 0 ? intersection : visible
  }

  return { isArmed, toggle, effectiveLayers }
}

// Test-only: module singletons outlive test files.
export function resetAttrLayerSelection(): void {
  armed.clear()
  armed.add(ATTR_PARAGON)
}
