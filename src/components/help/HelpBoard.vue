<script setup lang="ts">
/* Look-only 5 x 3 slice of the arena for the Help pictures. */

import { computed, useId } from 'vue'

import TileHatchPatterns from '@/components/grid/TileHatchPatterns.vue'
import type { State } from '@/lib/types/state'
import { useGameDataStore } from '@/stores/gameData'
import { getTileFillColor, getTileHatchFill, getTileHatchPoints } from '@/utils/tileStateFormatting'

type Cell = readonly [row: number, col: number]

const {
  tokens = [],
  paint = [],
  highlight,
  arrow,
  origin,
} = defineProps<{
  tokens?: readonly { slug: string; at: Cell }[]
  // Map editor tiles, in place of the row's usual fill.
  paint?: readonly { at: Cell; state: State }[]
  highlight?: Cell
  // 'target' is the Skills toggle's arrow; 'move' is a drag or tap path.
  arrow?: { from: Cell; to: Cell; kind: 'target' | 'move' }
  // Where a moved hero came from.
  origin?: Cell
}>()

const gameData = useGameDataStore()
const id = useId()

const COLS = 5
const ROWS = 3
const W = 19
const HALF = W / 2
const RISE = 16.5
const R = 11
const RING = 8.7
const ROW_FILL = ['#fde6e6', '#efefef', '#fff']

// Pointy-top rows alternate their offset, as on the arena.
const center = ([row, col]: Cell) => ({ x: col * W + (row % 2 ? W : HALF), y: row * RISE + R })

const corners = ({ x, y }: { x: number; y: number }) => [
  { x, y: y - R },
  { x: x + HALF, y: y - R / 2 },
  { x: x + HALF, y: y + R / 2 },
  { x, y: y + R },
  { x: x - HALF, y: y + R / 2 },
  { x: x - HALF, y: y - R / 2 },
]

const points = (center: { x: number; y: number }): string =>
  corners(center)
    .map((p) => `${p.x},${p.y}`)
    .join(' ')

const tiles = computed(() =>
  Array.from({ length: ROWS * COLS }, (_, i) => {
    const row = Math.floor(i / COLS)
    const col = i % COLS
    const painted = paint.find(({ at }) => at[0] === row && at[1] === col)
    return {
      key: i,
      fill: painted ? getTileFillColor(painted.state) : ROW_FILL[row],
      points: points(center([row, col])),
      hatch: painted ? getTileHatchFill(id, painted.state) : null,
      hatchPoints: getTileHatchPoints(corners(center([row, col]))),
    }
  }),
)

const placed = computed(() =>
  tokens.map((token) => {
    const level = gameData.characters.find((c) => c.name === token.slug)?.level ?? 'a'
    return {
      ...token,
      ...center(token.at),
      backdrop: gameData.getIcon(`bg-${level}`),
      portrait: gameData.getCharacterImage(token.slug),
    }
  }),
)

const originCenter = computed(() => (origin ? center(origin) : null))

// Both ends stop at the token rings; the bend keeps it from reading as a tile
// edge.
const arrowPath = computed(() => {
  if (!arrow) return null
  const a = center(arrow.from)
  const b = center(arrow.to)
  const len = Math.hypot(b.x - a.x, b.y - a.y)
  const ux = (b.x - a.x) / len
  const uy = (b.y - a.y) / len
  const sx = a.x + ux * (RING + 1)
  const sy = a.y + uy * (RING + 1)
  const ex = b.x - ux * (RING + 1.5)
  const ey = b.y - uy * (RING + 1.5)
  const cx = (sx + ex) / 2 + uy * 4
  const cy = (sy + ey) / 2 - ux * 4
  return `M${sx} ${sy} Q ${cx} ${cy} ${ex} ${ey}`
})
</script>

<template>
  <svg class="help-board" viewBox="0 0 104.5 55" aria-hidden="true">
    <defs>
      <clipPath :id="`${id}-clip`"><circle r="7.4" /></clipPath>
      <marker
        :id="`${id}-head`"
        viewBox="0 0 10 10"
        refX="7"
        refY="5"
        markerUnits="userSpaceOnUse"
        markerWidth="6"
        markerHeight="6"
        orient="auto"
      >
        <path d="M0,0 L10,5 L0,10z" :class="`help-arrow-${arrow?.kind ?? 'move'}`" />
      </marker>
      <TileHatchPatterns :id :hex-size="R" />
    </defs>
    <template v-for="tile in tiles" :key="tile.key">
      <polygon :points="tile.points" :fill="tile.fill" stroke="#d4cfc0" stroke-width="1" />
      <polygon v-if="tile.hatch" :points="tile.hatchPoints" :fill="tile.hatch" />
    </template>
    <polygon
      v-if="highlight"
      :points="points(center(highlight))"
      class="help-board-target"
      stroke-width="2"
    />
    <circle
      v-if="originCenter"
      :cx="originCenter.x"
      :cy="originCenter.y"
      :r="RING - 0.6"
      class="help-board-origin"
    />
    <g
      v-for="token in placed"
      :key="token.slug + token.at.join()"
      :transform="`translate(${token.x} ${token.y})`"
    >
      <circle :r="RING" fill="#fff" />
      <g :clip-path="`url(#${id}-clip)`">
        <image
          :href="token.backdrop"
          x="-7.5"
          y="-7.5"
          width="15"
          height="15"
          preserveAspectRatio="xMidYMid slice"
        />
        <image
          :href="token.portrait"
          x="-8.5"
          y="-8.5"
          width="17"
          height="17"
          preserveAspectRatio="xMidYMid slice"
        />
      </g>
    </g>
    <path
      v-if="arrowPath && arrow"
      :d="arrowPath"
      fill="none"
      stroke-width="2"
      stroke-linecap="round"
      :class="`help-arrow-${arrow.kind}`"
      :marker-end="`url(#${id}-head)`"
    />
  </svg>
</template>

<style scoped>
.help-board {
  display: block;
  width: 150px;
  overflow: visible;
}

.help-board-target {
  fill: #e3f2f0;
  stroke: var(--color-primary);
}

.help-arrow-target {
  fill: var(--color-danger);
  stroke: var(--color-danger);
}

.help-arrow-move {
  fill: var(--color-primary);
  stroke: var(--color-primary);
}

.help-board-origin {
  fill: rgba(255, 255, 255, 0.6);
  stroke: var(--color-text-secondary);
  stroke-width: 1.2;
  stroke-dasharray: 2 1.6;
}
</style>
