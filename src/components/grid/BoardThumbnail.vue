<script lang="ts">
import { computed, useId } from 'vue'

import { Grid } from '@/lib/grid'
import { Layout, POINTY, type Point } from '@/lib/layout'
import { getMapByKey } from '@/lib/maps'
import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'

/* One unit on a thumbnail: a portrait clipped to its hex, or a question-marked
   dot when the unit is unresolvable (retired seasonal content). */
export interface ThumbnailUnit {
  hexId: number
  team: Team
  image?: string
  highlight?: boolean
}

interface Geometry {
  viewBox: string
  points: Map<number, string>
  centers: Map<number, Point>
  // `renderTiles` walks `points`, so an artifact cell listed there would draw
  // as a tile.
  artifactCenters: Record<'ally' | 'enemy', Point>
}

/* Hex geometry depends only on hexSize (+ optional square viewBox), never on the
   map, so it's cached at module level: a full saved-teams library renders
   hundreds of boards from one polygon set. */
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

  // Must match GridArtifacts' host cells. They land in the empty corners of the
  // hex grid's bounding box, so drawing there costs no framing change.
  const artifactCenters = {
    ally: layout.hexToPixel(grid.getHexById(1).neighbor(4)),
    enemy: layout.hexToPixel(grid.getHexById(45).neighbor(1)),
  }

  const geometry: Geometry = {
    viewBox: viewBoxSize
      ? `0 0 ${viewBoxSize} ${viewBoxSize}`
      : `${(minX - 1).toFixed(1)} ${(minY - 1).toFixed(1)} ${(maxX - minX + 2).toFixed(1)} ${(maxY - minY + 2).toFixed(1)}`,
    points,
    centers,
    artifactCenters,
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
    // Portraits are partially transparent, so occupied tiles still need their
    // zone's backing.
    case State.AVAILABLE_ALLY:
    case State.OCCUPIED_ALLY:
      return 'rgba(54, 149, 142, 0.35)'
    case State.AVAILABLE_ENEMY:
    case State.OCCUPIED_ENEMY:
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

/* Well under the hex it sits in, so the icon reads as an attachment to the board
   rather than a sixth unit. */
const ARTIFACT_RADIUS_RATIO = 0.62

const ARTIFACT_SIDES = [
  { side: 'ally', team: Team.ALLY },
  { side: 'enemy', team: Team.ENEMY },
] as const
</script>

<script setup lang="ts">
/* Presentational SVG hex-board renderer shared by the maps-tab/Map Editor
   previews (map only) and the saved-team thumbnails (map + unit portraits).
   Pure data → SVG: no live grid contexts, nothing captured from the DOM. */

const {
  mapKey,
  tiles,
  units = [],
  artifacts,
  hexSize = 7,
  viewBoxSize,
} = defineProps<{
  mapKey: string
  // Explicit [hexId, state] tile states (a record's serialized `t`), the
  // authoritative source when present, matching restore semantics (all tiles
  // default except these). Omitted = the map config's baseline (empty boards,
  // map pickers).
  tiles?: number[][]
  units?: ThumbnailUnit[]
  artifacts?: { ally?: string; enemy?: string }
  hexSize?: number
  // Square viewBox with a centered board (the maps tab's framing); omitted =
  // tight-fit bounds, the right default for card thumbnails.
  viewBoxSize?: number
}>()

const uid = useId()

const geometry = computed(() => getGeometry(hexSize, viewBoxSize))
const states = computed(() => {
  if (!tiles) return getMapStates(mapKey)
  const explicit = new Map<number, State>()
  for (const entry of tiles) {
    const [hexId, state] = entry
    if (hexId !== undefined && state !== undefined) explicit.set(hexId, state)
  }
  return explicit
})

const renderTiles = computed(() =>
  [...geometry.value.points.entries()].map(([hexId, points]) => ({
    hexId,
    points,
    fill: getTileFill(states.value.get(hexId)),
  })),
)

// The unit's hex (portrait clip + ring) is the tile polygon itself: any inset
// puts the ring parallel to the tile border and the two hairlines blur into
// one thick-looking band.
const placedUnits = computed(() =>
  units
    .filter((unit) => geometry.value.centers.has(unit.hexId))
    .map((unit) => ({
      ...unit,
      center: geometry.value.centers.get(unit.hexId)!,
      corners: geometry.value.points.get(unit.hexId)!,
      color: teamColor(unit.team),
      imageSize: hexSize * 2.2,
    })),
)

const placedArtifacts = computed(() =>
  ARTIFACT_SIDES.flatMap(({ side, team }) => {
    const image = artifacts?.[side]
    if (image === undefined) return []
    return [
      {
        side,
        image,
        center: geometry.value.artifactCenters[side],
        radius: hexSize * ARTIFACT_RADIUS_RATIO,
        color: teamColor(team),
      },
    ]
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
      <clipPath v-for="art in placedArtifacts" :id="`${uid}-a-${art.side}`" :key="art.side">
        <circle :cx="art.center.x" :cy="art.center.y" :r="art.radius" />
      </clipPath>
    </defs>

    <!-- Opaque so shared edges don't double-composite darker; a step below the
         live grid's #ccc because hairlines need more contrast at this scale. -->
    <polygon
      v-for="tile in renderTiles"
      :key="tile.hexId"
      :points="tile.points"
      :fill="tile.fill"
      stroke="#aaa"
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
        <!-- Team ring replaces the tile's border line at the same stroke
             width: a heavier ring shrinks the already-small portraits. -->
        <polygon :points="unit.corners" fill="none" :stroke="unit.color" stroke-width="1" />
      </template>
      <template v-else>
        <circle
          :cx="unit.center.x"
          :cy="unit.center.y"
          :r="hexSize * 0.55"
          :fill="unit.color"
          stroke="#fff"
          :stroke-width="Math.max(1, hexSize * 0.14)"
        />
        <text
          :x="unit.center.x"
          :y="unit.center.y"
          fill="#fff"
          :font-size="hexSize * 0.8"
          font-weight="700"
          font-family="sans-serif"
          text-anchor="middle"
          dominant-baseline="central"
        >
          ?
        </text>
      </template>
      <!-- Drawn last to overdraw the team ring. Literal amber, not the token:
           exports serialize the SVG standalone. -->
      <polygon
        v-if="unit.highlight"
        :points="unit.corners"
        fill="none"
        stroke="#f9a825"
        stroke-width="2"
      />
    </g>

    <g v-for="art in placedArtifacts" :key="`artifact-${art.side}`">
      <image
        :href="art.image"
        :x="art.center.x - art.radius"
        :y="art.center.y - art.radius"
        :width="art.radius * 2"
        :height="art.radius * 2"
        preserveAspectRatio="xMidYMid slice"
        :clip-path="`url(#${uid}-a-${art.side})`"
      />
      <circle
        :cx="art.center.x"
        :cy="art.center.y"
        :r="art.radius"
        fill="none"
        :stroke="art.color"
        stroke-width="1"
      />
    </g>
  </svg>
</template>
