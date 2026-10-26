<script setup lang="ts">
/* Look-only 5 x 3 slice of the arena for the Help pictures. */

import { computed, useId } from 'vue'

import TileHatchPatterns from '@/components/grid/TileHatchPatterns.vue'
import { State } from '@/lib/types/state'
import { useGameDataStore } from '@/stores/gameData'
import {
  compareWallDrawOrder,
  getTileFillColor,
  getTileHatchFill,
  getTileStrokeColor,
  getWallStrokeColor,
} from '@/utils/tileStateFormatting'

type Cell = readonly [row: number, col: number]

const {
  tokens = [],
  paint = [],
  highlight,
  arrow,
  origin,
  ring,
} = defineProps<{
  tokens?: readonly { slug: string; at: Cell }[]
  // Map editor tiles, in place of the row's usual fill.
  paint?: readonly { at: Cell; state: State }[]
  highlight?: Cell
  // 'target' is the Skills toggle's arrow; 'move' is a drag or tap path.
  arrow?: { from: Cell; to: Cell; kind: 'target' | 'move' }
  // Where a moved hero came from.
  origin?: Cell
  // The hero a saved-team search picked: ringed, with the board's other heroes
  // faded, or the whole board faded when it does not field the hero.
  ring?: string
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
const ROW_STATE = [State.AVAILABLE_ENEMY, State.DEFAULT, State.AVAILABLE_ALLY]

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
    const state = painted?.state ?? ROW_STATE[row]!
    return {
      key: i,
      state,
      fill: getTileFillColor(state),
      outline: getTileStrokeColor(state),
      points: points(center([row, col])),
      hatch: getTileHatchFill(id, state),
      stroke: getWallStrokeColor(state),
    }
  }),
)

const wallTiles = computed(() =>
  tiles.value
    .filter((tile): tile is typeof tile & { stroke: string } => tile.stroke !== null)
    .sort((a, b) => compareWallDrawOrder(a.state, b.state)),
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

const ringed = computed(() => placed.value.filter((token) => token.slug === ring))

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
  <svg
    class="help-board"
    :class="{ faded: ring !== undefined && ringed.length === 0 }"
    viewBox="0 0 104.5 55"
    aria-hidden="true"
  >
    <defs>
      <clipPath :id="`${id}-clip`"><circle r="7.4" /></clipPath>
      <filter
        v-if="ringed.length"
        :id="`${id}-ring-edge`"
        x="-50%"
        y="-50%"
        width="200%"
        height="200%"
      >
        <feGaussianBlur stdDeviation="0.9" />
      </filter>
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
      <TileHatchPatterns :id :hex-size="R" light />
    </defs>
    <template v-for="tile in tiles" :key="tile.key">
      <polygon
        :points="tile.points"
        :style="{ fill: tile.fill, stroke: tile.outline }"
        stroke-width="1"
      />
      <polygon v-if="tile.hatch" :points="tile.points" :fill="tile.hatch" />
    </template>
    <polygon
      v-for="tile in wallTiles"
      :key="`wall-border-${tile.key}`"
      :points="tile.points"
      fill="none"
      :style="{ stroke: tile.stroke }"
      stroke-width="1"
    />
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
      :class="{ faded: ringed.length > 0 && token.slug !== ring }"
      :transform="`translate(${token.x} ${token.y})`"
    >
      <circle :r="RING" class="help-board-token-ring" />
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
    <template v-for="token in ringed" :key="`ring-${token.at.join()}`">
      <circle
        :cx="token.x"
        :cy="token.y"
        :r="RING + 0.4"
        class="help-board-ring-edge"
        :filter="`url(#${id}-ring-edge)`"
      />
      <circle :cx="token.x" :cy="token.y" :r="RING + 0.4" class="help-board-ring" />
    </template>
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
  fill: var(--help-target-fill);
  stroke: var(--color-primary);
}

.help-board-token-ring {
  fill: var(--unit-ring);
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
  fill: color-mix(in srgb, var(--tile-fill-ally) 60%, transparent);
  stroke: var(--color-text-secondary);
  stroke-width: 1.2;
  stroke-dasharray: 2 1.6;
}

.faded {
  opacity: 0.35;
}

.help-board-ring {
  fill: none;
  stroke: var(--color-warning);
  stroke-width: 2.6;
}

.help-board-ring-edge {
  fill: none;
  stroke: rgba(0, 0, 0, 0.45);
  stroke-width: 4.4;
}
</style>
