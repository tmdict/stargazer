<script lang="ts">
import { computed, useId } from 'vue'

import { Grid } from '@/lib/grid'
import { Hex } from '@/lib/hex'
import { Layout, POINTY, type Point } from '@/lib/layout'
import { getMapByKey } from '@/lib/maps'
import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'

/* One unit on a thumbnail: a portrait clipped to its hex (dot fallback when the
   image is unresolvable) with a team-colored ring. */
export interface ThumbnailUnit {
  hexId: number
  team: Team
  image?: string
}

interface Geometry {
  viewBox: string
  points: Map<number, string>
  centers: Map<number, Point>
}

/* Hex geometry depends only on hexSize (+ optional square viewBox), never on the
   map, so it's computed once at module level and shared by every thumbnail —
   at the saved-teams cap that's 1,000 boards reusing one polygon set instead of
   recomputing 45 corners each. */
const geometryCache = new Map<string, Geometry>()

function getGeometry(hexSize: number, viewBoxSize?: number): Geometry {
  const key = `${hexSize}:${viewBoxSize ?? 'fit'}`
  const cached = geometryCache.get(key)
  if (cached) return cached

  const origin = viewBoxSize ? viewBoxSize / 2 : 0
  const layout = new Layout(POINTY, { x: hexSize, y: hexSize }, { x: origin, y: origin })
  const grid = new Grid()

  const points = new Map<number, string>()
  const centers = new Map<number, Point>()
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const hex of grid.keys()) {
    const corners = layout.polygonCorners(hex)
    for (const corner of corners) {
      if (corner.x < minX) minX = corner.x
      if (corner.x > maxX) maxX = corner.x
      if (corner.y < minY) minY = corner.y
      if (corner.y > maxY) maxY = corner.y
    }
    points.set(hex.getId(), corners.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '))
    centers.set(hex.getId(), layout.hexToPixel(hex))
  }

  const geometry: Geometry = {
    viewBox: viewBoxSize
      ? `0 0 ${viewBoxSize} ${viewBoxSize}`
      : `${(minX - 1).toFixed(1)} ${(minY - 1).toFixed(1)} ${(maxX - minX + 2).toFixed(1)} ${(maxY - minY + 2).toFixed(1)}`,
    points,
    centers,
  }
  geometryCache.set(key, geometry)
  return geometry
}

/* Tile states per map are also map-only data: one throwaway Grid per map key,
   cached for every thumbnail that renders that map. */
const mapStateCache = new Map<string, Map<number, State>>()

function getMapStates(mapKey: string): Map<number, State> {
  const cached = mapStateCache.get(mapKey)
  if (cached) return cached
  const grid = new Grid(undefined, getMapByKey(mapKey) ?? undefined)
  const states = new Map<number, State>()
  for (const tile of grid.getAllTiles()) {
    states.set(tile.hex.getId(), tile.state)
  }
  mapStateCache.set(mapKey, states)
  return states
}

function getTileFill(state: State | undefined): string {
  switch (state) {
    case State.AVAILABLE_ALLY:
      return 'rgba(54, 149, 142, 0.35)'
    case State.AVAILABLE_ENEMY:
      return 'rgba(200, 35, 51, 0.35)'
    case State.BLOCKED:
      return 'rgba(128, 128, 128, 0.45)'
    case State.BLOCKED_BREAKABLE:
      return 'rgba(128, 128, 128, 0.28)'
    default:
      return 'rgba(255, 255, 255, 0.08)'
  }
}

const teamColor = (team: Team): string => (team === Team.ALLY ? '#36958e' : '#c82333')

// The unit's inner hex (portrait clip + ring) is slightly inset from the tile.
const UNIT_SCALE = 0.92
</script>

<script setup lang="ts">
/* Presentational SVG hex-board renderer shared by the maps-tab/Map Editor
   previews (map only) and the saved-team thumbnails (map + unit portraits).
   Pure data → SVG: no live grid contexts, nothing captured from the DOM. */

const {
  mapKey,
  units = [],
  hexSize = 7,
  viewBoxSize,
} = defineProps<{
  mapKey: string
  units?: ThumbnailUnit[]
  hexSize?: number
  // Square viewBox with a centered board (the maps tab's historical framing);
  // omitted = tight-fit bounds, the right default for card thumbnails.
  viewBoxSize?: number
}>()

const uid = useId()

const geometry = computed(() => getGeometry(hexSize, viewBoxSize))
const states = computed(() => getMapStates(mapKey))

const tiles = computed(() =>
  [...geometry.value.points.entries()].map(([hexId, points]) => ({
    hexId,
    points,
    fill: getTileFill(states.value.get(hexId)),
  })),
)

const unitScale = computed(() => {
  const layout = new Layout(
    POINTY,
    { x: hexSize * UNIT_SCALE, y: hexSize * UNIT_SCALE },
    { x: 0, y: 0 },
  )
  return layout
})

const placedUnits = computed(() =>
  units
    .filter((unit) => geometry.value.centers.has(unit.hexId))
    .map((unit) => {
      const center = geometry.value.centers.get(unit.hexId)!
      // Inner hex corners around the unit's center, for the clip and the ring.
      const corners = unitScale.value
        .polygonCorners(new Hex(0, 0, 0))
        .map((p) => `${(center.x + p.x).toFixed(1)},${(center.y + p.y).toFixed(1)}`)
        .join(' ')
      return {
        ...unit,
        center,
        corners,
        color: teamColor(unit.team),
        imageSize: hexSize * 2.2,
      }
    }),
)
</script>

<template>
  <svg :viewBox="geometry.viewBox">
    <defs>
      <!-- Clip paths only for occupied hexes, not all 45 tiles. -->
      <clipPath v-for="unit in placedUnits" :id="`${uid}-u-${unit.hexId}`" :key="unit.hexId">
        <polygon :points="unit.corners" />
      </clipPath>
    </defs>

    <polygon
      v-for="tile in tiles"
      :key="tile.hexId"
      :points="tile.points"
      :fill="tile.fill"
      stroke="rgba(0, 0, 0, 0.1)"
      stroke-width="1"
    />

    <g v-for="unit in placedUnits" :key="`unit-${unit.hexId}`">
      <template v-if="unit.image">
        <image
          :href="unit.image"
          :x="unit.center.x - unit.imageSize / 2"
          :y="unit.center.y - unit.imageSize / 2"
          :width="unit.imageSize"
          :height="unit.imageSize"
          preserveAspectRatio="xMidYMid slice"
          :clip-path="`url(#${uid}-u-${unit.hexId})`"
        />
        <polygon
          :points="unit.corners"
          fill="none"
          :stroke="unit.color"
          :stroke-width="Math.max(1, hexSize * 0.16)"
        />
      </template>
      <circle
        v-else
        :cx="unit.center.x"
        :cy="unit.center.y"
        :r="hexSize * 0.55"
        :fill="unit.color"
        stroke="#fff"
        :stroke-width="Math.max(1, hexSize * 0.14)"
      />
    </g>
  </svg>
</template>
