import { computed } from 'vue'

import { useGridContext } from '@/composables/useGridContext'
import { BOARD_SIZE, PORTRAIT_RADIUS } from '@/lib/layout'
import { useGridStore } from '@/stores/grid'

/**
 * Stroke sizes shared by arrows and skill lines, so every layer draws them alike.
 */
export function useArrowStyle() {
  const gridStore = useGridStore()
  return computed(() => {
    const scale = gridStore.getHexScale()
    return {
      strokeWidth: Math.max(2, 3 * scale),
      arrowheadSize: Math.max(4, 6 * scale),
    }
  })
}

/**
 * Geometry of the arrow overlay SVG (GridArrowLayer), aligned to the grid.
 */
export function useArrowLayer() {
  const gridStore = useGridStore()
  const ctx = useGridContext()

  // The layer undoes the board's perspective squash, as portraits do, so strokes
  // and arrowheads keep their shape; the layout's arrow paths come out in these
  // upright coordinates.
  const svgDimensions = computed(() => {
    const size = BOARD_SIZE * gridStore.getHexScale()
    return { width: size, height: size * ctx.layout.squash }
  })

  const layerStyle = computed(() =>
    ctx.perspective
      ? { transform: `scaleY(${1 / ctx.layout.squash})`, transformOrigin: '0 0' }
      : {},
  )

  // Perspective stands the portraits above their tiles, so arrows between units
  // rise to the portrait centers.
  const layerTransform = computed(() =>
    ctx.perspective
      ? `translate(0, ${-ctx.layout.standingLift(PORTRAIT_RADIUS * gridStore.getHexScale()) * ctx.layout.squash})`
      : '',
  )

  return { svgDimensions, layerStyle, layerTransform }
}
