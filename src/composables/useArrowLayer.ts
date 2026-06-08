import { computed, toValue, type MaybeRefOrGetter } from 'vue'

import { useGridStore } from '@/stores/grid'

/**
 * Shared geometry and styling for the arrow overlay SVGs (normal targeting and
 * skill targeting), keeping both layers aligned to the grid and visually matched.
 */
export function useArrowLayer(
  showPerspective: MaybeRefOrGetter<boolean>,
  defaultSvgHeight: MaybeRefOrGetter<number>,
) {
  const gridStore = useGridStore()

  const svgDimensions = computed(() => {
    const scale = gridStore.getHexScale()
    return { width: 600 * scale, height: toValue(defaultSvgHeight) * scale }
  })

  const arrowStyle = computed(() => {
    const scale = gridStore.getHexScale()
    return {
      strokeWidth: Math.max(2, 3 * scale),
      arrowheadSize: Math.max(4, 6 * scale),
    }
  })

  // Perspective mode lifts the arrow layer to sit on the tilted grid.
  const layerTransform = computed(() =>
    toValue(showPerspective) ? `translate(0, ${-75 * gridStore.getHexScale()})` : '',
  )

  return { svgDimensions, arrowStyle, layerTransform }
}
