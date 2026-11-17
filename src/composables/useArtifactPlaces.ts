/* Where a board's two artifact places sit and how they stack: the host cell
 * beside each side, its outline for the cell layer, and the box of the icon
 * that stands on it. The Arena's artifact layer and the Honor Duel board's
 * draw on the same places, and an Honor Duel board's off-field spots stand
 * icons of the same size on cells of their own. */

import { computed } from 'vue'

import { artifactHostHex } from '@/lib/grid'
import { ARTIFACT_RADIUS, BOARD_SIZE } from '@/lib/layout'
import { Team } from '@/lib/types/team'
import type { GridContext } from '@/stores/gridContext'

// Artifact icon geometry (at 40px hex radius). Icons are full-bleed square art
// that fills the circle; only the container scales with the breakpoint.
const BASE_ARTIFACT_SIZE = 2 * ARTIFACT_RADIUS

export function useArtifactPlaces(ctx: GridContext) {
  // The host-cell SVG shares the full grid box and coordinate space with GridTiles,
  // so it compresses with the perspective wrapper exactly like the real hexes.
  const gridPixelSize = computed(() => BOARD_SIZE * ctx.hexScale)

  const dimensions = computed(() => {
    const scale = ctx.hexScale
    return {
      containerSize: BASE_ARTIFACT_SIZE * scale,
      borderWidth: Math.max(2, 2 * scale),
    }
  })

  const iconStyle = (center: { x: number; y: number }) => {
    const { containerSize, borderWidth } = dimensions.value
    const styles: Record<string, string | number> = {
      width: `${containerSize}px`,
      height: `${containerSize}px`,
      '--artifact-border-width': `${borderWidth}px`,
      left: `${center.x - containerSize / 2}px`,
      top: `${center.y - containerSize / 2}px`,
    }
    if (ctx.perspective) styles.transform = ctx.layout.standingTransform(containerSize / 2)
    return styles
  }

  // Host cells are never a hex-pipeline drop target.
  const place = (team: Team) => {
    const hex = computed(() => artifactHostHex(ctx.grid, team))
    const center = computed(() => ctx.layout.hexToPixel(hex.value))
    return {
      center,
      points: computed(() => ctx.layout.polygonPoints(hex.value)),
      style: computed(() => iconStyle(center.value)),
    }
  }

  return {
    gridPixelSize,
    iconStyle,
    ally: place(Team.ALLY),
    enemy: place(Team.ENEMY),
    // "Front" is the slot that renders at the screen-bottom (near) edge, which
    // must sit above the sprites behind it; the inverted view rotates the enemy
    // cell down there. The ally slot is always visible: team view shows your
    // team.
    allyInFront: computed(() => !ctx.inverted),
    enemyInFront: computed(() => ctx.inverted),
    enemyVisible: computed(() => !ctx.teamView),
  }
}
