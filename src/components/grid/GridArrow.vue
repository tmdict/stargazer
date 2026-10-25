<script setup lang="ts">
import { computed } from 'vue'

import { useGridContext } from '@/composables/useGridContext'
import type { Hex } from '@/lib/hex'
import { PORTRAIT_RADIUS } from '@/lib/layout'

// Endpoints are hexes, not tile ids, so an arrow can start from an off-grid
// artifact host cell as well as from a tile.
interface Props {
  startHex: Hex
  endHex: Hex
  color: string
  strokeWidth: number
  arrowheadSize: number
  characterRadius?: number
  // An artifact icon's radius when the arrow leaves one.
  startRadius?: number
  invertCurve?: boolean
  curveScale?: number
  // In perspective, arc up through the air rather than bow sideways. Two arrows
  // joining the same two units in opposite directions turn it off, because their
  // arcs would lie on top of each other.
  arc?: boolean
  dashed?: boolean
  id: string
}

const props = withDefaults(defineProps<Props>(), {
  characterRadius: PORTRAIT_RADIUS,
  invertCurve: false,
  curveScale: 1,
  arc: true,
  dashed: false,
})

const ctx = useGridContext()

// Marker ids are document-wide and `id` is only unique within a board, so the
// board id keeps a multi-board page from defining one arrowhead twice.
const markerId = computed(() => `arrowhead-${ctx.id}-${props.id}`)

// The white head is sized in user units: in stroke widths it would scale with the
// shadow path's wider stroke and outgrow the coloured head.
const headPoints = computed(() => {
  const length = props.arrowheadSize * props.strokeWidth
  return `0 0, ${length} ${length * 0.35}, 0 ${length * 0.7}`
})

const dashArray = computed(() => {
  if (!props.dashed) return undefined
  const dash = 8 * ctx.hexScale
  return `${dash},${dash}`
})

const pathData = computed(() =>
  ctx.layout.getArrowPath(props.startHex, props.endHex, props.characterRadius * ctx.hexScale, {
    invertCurve: props.invertCurve,
    curveScale: props.curveScale,
    arc: props.arc,
    startRadius: (props.startRadius ?? props.characterRadius) * ctx.hexScale,
  }),
)
</script>

<template>
  <g class="grid-arrow">
    <defs>
      <marker
        :id="markerId"
        :markerWidth="arrowheadSize"
        :markerHeight="arrowheadSize * 0.7"
        :refX="arrowheadSize - 1"
        :refY="arrowheadSize * 0.35"
        orient="auto"
      >
        <polygon
          :points="`0 0, ${arrowheadSize} ${arrowheadSize * 0.35}, 0 ${arrowheadSize * 0.7}`"
          :fill="color"
        />
      </marker>
      <!-- A white copy of the head, 2px larger all round like the line's edge, drawn
           on the shadow path so it sits under the line and the head. -->
      <marker
        :id="`${markerId}-shadow`"
        markerUnits="userSpaceOnUse"
        :markerWidth="arrowheadSize * strokeWidth"
        :markerHeight="arrowheadSize * strokeWidth * 0.7"
        :refX="(arrowheadSize - 1) * strokeWidth"
        :refY="arrowheadSize * strokeWidth * 0.35"
        orient="auto"
        overflow="visible"
      >
        <polygon
          :points="headPoints"
          fill="white"
          stroke="white"
          stroke-width="4"
          stroke-linejoin="round"
        />
      </marker>
    </defs>
    <!-- White shadow path for better visibility -->
    <path
      v-if="pathData"
      :d="pathData"
      stroke="white"
      :stroke-width="strokeWidth + 4"
      fill="none"
      opacity="0.8"
      stroke-linecap="round"
      :stroke-dasharray="dashArray"
      :marker-end="`url(#${markerId}-shadow)`"
    />
    <path
      v-if="pathData"
      :d="pathData"
      :stroke="color"
      :stroke-width="strokeWidth"
      fill="none"
      opacity="0.8"
      :marker-end="`url(#${markerId})`"
      :stroke-dasharray="dashArray"
    />
  </g>
</template>
