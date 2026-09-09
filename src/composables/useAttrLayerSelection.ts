/* Page-global upgrade-layer choice for the edit docks: which upgrade layer
 * (paragon, refinement, or all of them) portrait taps and bulk actions edit.
 * State is a module-level singleton (like useSelectionState / useDragDrop) so
 * every board's dock and panel share one choice — a chip picked on any dock
 * flips them all. Unlike useSelectionState it references no boards or hexes,
 * so it needs no route-change or rebuild reset; session-only by design.
 *
 * The chips are mutually exclusive, with ALL as its own choice rather than a
 * lit pair: paragon and refinement are usually edited separately, and one tap
 * must switch between them. The *effective* layers are the choice restricted
 * to the visible layers — a hidden layer must never be silently edited. The
 * single Grid Info "Upgrades" toggle shows both layers or none, so visible is
 * all-or-nothing; the semantics stay layer-general regardless: a hidden single
 * choice falls back to the visible layers, and with nothing visible, editing
 * no-ops.
 */

import { ref } from 'vue'

import { ATTR_PARAGON } from '@/lib/characters/attributes'

export type AttrLayerChoice = number | 'all'

const choice = ref<AttrLayerChoice>(ATTR_PARAGON)

export function useAttrLayerSelection(): {
  select: (next: AttrLayerChoice) => void
  effectiveLayers: (visible: number[]) => number[]
  litChoice: (visible: number[]) => AttrLayerChoice | null
} {
  const select = (next: AttrLayerChoice): void => {
    choice.value = next
  }

  const effectiveLayers = (visible: number[]): number[] => {
    const current = choice.value
    return current !== 'all' && visible.includes(current) ? [current] : visible
  }

  // The lit chip follows the effective set, not the raw choice, so a hidden
  // choice's fallback lights exactly what taps will edit.
  const litChoice = (visible: number[]): AttrLayerChoice | null => {
    const effective = effectiveLayers(visible)
    if (effective.length === 0) return null
    return effective.length === 1 ? effective[0]! : 'all'
  }

  return { select, effectiveLayers, litChoice }
}

// Test-only: module singletons outlive test files.
export function resetAttrLayerSelection(): void {
  choice.value = ATTR_PARAGON
}
