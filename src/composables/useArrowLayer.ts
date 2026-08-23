import { computed, toValue, type MaybeRefOrGetter } from 'vue'

import { Team } from '@/lib/types/team'
import { useGridStore } from '@/stores/grid'

// Arrows that belong to a team rather than a skill (closest-target and
// artifact arrows) share one hue per team.
export const TEAM_ARROW_COLORS: Record<Team, string> = {
  [Team.ALLY]: '#36958e',
  [Team.ENEMY]: '#dc3545',
}

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
