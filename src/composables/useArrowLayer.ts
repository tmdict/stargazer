import { computed, toValue, type MaybeRefOrGetter } from 'vue'

import { useGridContext } from '@/composables/useGridContext'
import { PORTRAIT_RADIUS, standingLift } from '@/lib/layout'
import { Team } from '@/lib/types/team'
import { useGridStore } from '@/stores/grid'

// Arrows that belong to a team rather than a skill (closest-target and
// artifact arrows) share one hue per team.
export const TEAM_ARROW_COLORS: Record<Team, string> = {
  [Team.ALLY]: '#36958e',
  [Team.ENEMY]: '#dc3545',
}

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
 * Shared geometry and styling for the arrow overlay SVGs (normal targeting and
 * skill targeting), keeping both layers aligned to the grid and visually matched.
 */
export function useArrowLayer(defaultSvgHeight: MaybeRefOrGetter<number>) {
  const gridStore = useGridStore()
  const ctx = useGridContext()

  const svgDimensions = computed(() => {
    const scale = gridStore.getHexScale()
    return { width: 600 * scale, height: toValue(defaultSvgHeight) * scale }
  })

  const arrowStyle = useArrowStyle()

  // Perspective stands the portraits above their tiles, so arrows between units
  // rise to the portrait centers.
  const layerTransform = computed(() =>
    ctx.perspective
      ? `translate(0, ${-standingLift(PORTRAIT_RADIUS * gridStore.getHexScale())})`
      : '',
  )

  return { svgDimensions, arrowStyle, layerTransform }
}
