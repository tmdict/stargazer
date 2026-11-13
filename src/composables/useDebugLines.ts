/* The units whose pathfinding lines the Debug tab hides, by tile. The panel's
 * checkboxes write the set and the board's debug layer reads it. */

import { ref } from 'vue'

const hidden = ref<ReadonlySet<number>>(new Set())

export function useDebugLines() {
  const shown = (hexId: number): boolean => !hidden.value.has(hexId)

  const toggle = (hexId: number): void => {
    const next = new Set(hidden.value)
    if (!next.delete(hexId)) next.add(hexId)
    hidden.value = next
  }

  const showAll = (): void => {
    hidden.value = new Set()
  }

  return { shown, toggle, showAll }
}
