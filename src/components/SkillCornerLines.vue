<script setup lang="ts">
/* Skill lines traced along tile corners (zone outlines, lane boundaries). They lie
   on the board's surface, so GridTiles draws them in its own SVG, under the
   artifact icons and portraits that stand above the tiles in perspective. */

import { computed } from 'vue'

import GridLine from './grid/GridLine.vue'
import { useArrowStyle } from '@/composables/useArrowLayer'
import { useGridContext } from '@/composables/useGridContext'
import { clipLaneBoundary } from '@/lib/skills/utils/line'

const ctx = useGridContext()
const arrowStyle = useArrowStyle()

const visibleHexIds = computed(() => new Set(ctx.visibleHexes.map((hex) => hex.getId())))

// A same-hex line is an exact tile edge (a zone-outline segment) kept iff its tile
// is shown; a two-hex (lane-boundary) line spans the visible cells of its lane and
// the adjacent lane it borders, so it runs edge to edge across the shown region (the
// whole grid outside team view).
const lines = computed(() =>
  ctx.skillLines
    .flatMap((line) => {
      if (line.fromCorner === undefined || line.toCorner === undefined) return []
      if (line.fromHexId === line.toHexId) {
        return visibleHexIds.value.has(line.fromHexId) ? [line] : []
      }
      const laneS = ctx.grid.getHexById(line.fromHexId).s
      const clip = clipLaneBoundary(ctx.visibleHexes, laneS, line.fromCorner)
      return clip ? [{ ...line, ...clip }] : []
    })
    .map((line) => ({
      ...line,
      fromHex: ctx.grid.getHexById(line.fromHexId),
      toHex: ctx.grid.getHexById(line.toHexId),
    })),
)
</script>

<template>
  <g class="skill-corner-lines" pointer-events="none">
    <GridLine
      v-for="(line, idx) in lines"
      :key="idx"
      :start-hex="line.fromHex"
      :end-hex="line.toHex"
      :start-corner="line.fromCorner"
      :end-corner="line.toCorner"
      :color="line.color"
      :stroke-width="arrowStyle.strokeWidth"
    />
  </g>
</template>
