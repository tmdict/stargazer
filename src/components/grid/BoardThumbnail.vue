<script lang="ts">
import { computed, useId } from 'vue'

import { artifactHostHex, Grid } from '@/lib/grid'
import { Layout, POINTY, type Point } from '@/lib/layout'
import { getMapByKey } from '@/lib/maps'
import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'

/* One unit on a thumbnail: a portrait clipped to its hex, or a team-colored
   dot when the unit is unresolvable — "?" by default, or the caller's label
   (retired seasonal content shows its season, e.g. "S7"). */
export interface ThumbnailUnit {
  hexId: number
  team: Team
  image?: string
  label?: string
  title?: string
  // Ringed; one ringed unit fades the board's other units and artifacts.
  highlight?: boolean
}

// An artifact slot: an image URL, or a labeled placeholder circle.
export type ThumbnailArtifact = string | { label: string; title?: string }

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

  // Host cells land in the empty corners of the hex grid's bounding box, so
  // drawing there costs no framing change.
  const artifactCenters = {
    ally: layout.hexToPixel(artifactHostHex(grid, Team.ALLY)),
    enemy: layout.hexToPixel(artifactHostHex(grid, Team.ENEMY)),
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

/* The crisp look, for the preview modal: the thumbnail's own fills and team
   colours, with one border on every deployment and wall tile (open ground
   drawn first, so a shared edge never shows two colours), a dark bevel line
   inside each framed tile, a hatch inside each wall (lighter for a breakable
   one), and each portrait clipped
   under a dark rim inside a 2px team frame. Ratios are of hexSize; strokes
   are fixed in screen pixels. */
const CRISP = {
  inset: 1.6 / 18,
  bevel: 2.5 / 18,
  wall: 4 / 18,
}
type Zone = 'void' | 'ally' | 'enemy' | 'blocked' | 'breakable'
function zoneOf(state: State | undefined): Zone {
  switch (state) {
    case State.AVAILABLE_ALLY:
    case State.OCCUPIED_ALLY:
      return 'ally'
    case State.AVAILABLE_ENEMY:
    case State.OCCUPIED_ENEMY:
      return 'enemy'
    case State.BLOCKED:
      return 'blocked'
    case State.BLOCKED_BREAKABLE:
      return 'breakable'
    default:
      return 'void'
  }
}
// A pointy-top hex of radius r around a center, as a points string.
const hexAt = (center: Point, r: number): string =>
  Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 90)
    return `${(center.x + r * Math.cos(a)).toFixed(1)},${(center.y + r * Math.sin(a)).toFixed(1)}`
  }).join(' ')

/* Well under the hex it sits in, so the icon reads as an attachment to the board
   rather than a sixth unit. */
const ARTIFACT_RADIUS_RATIO = 0.62

// The amber ring rides on a soft dark halo, so it reads over pale tiles and
// bright portraits alike without a hard outline.
const RING_RATIO = 0.3
const RING_EDGE_RATIO = 0.5
const RING_EDGE_BLUR_RATIO = 0.08

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
  crisp = false,
} = defineProps<{
  mapKey: string
  // Explicit [hexId, state] tile states (a record's serialized `t`), the
  // authoritative source when present, matching restore semantics (all tiles
  // default except these). Omitted = the map config's baseline (empty boards,
  // map pickers).
  tiles?: number[][]
  units?: ThumbnailUnit[]
  artifacts?: { ally?: ThumbnailArtifact; enemy?: ThumbnailArtifact }
  hexSize?: number
  // Square viewBox with a centered board (the maps tab's framing); omitted =
  // tight-fit bounds, the right default for card thumbnails.
  viewBoxSize?: number
  // The report's board style, for the preview modal.
  crisp?: boolean
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

// Open ground first, then every framed tile, so a shared edge always shows the
// light border; walls carry a hatch, deployment tiles their number.
const crispTiles = computed(() => {
  const size = hexSize
  return [...geometry.value.centers.entries()]
    .map(([hexId, center]) => {
      const zone = zoneOf(states.value.get(hexId))
      const wall = zone === 'blocked' || zone === 'breakable'
      return {
        hexId,
        zone,
        wall,
        fill: getTileFill(states.value.get(hexId)),
        points: geometry.value.points.get(hexId)!,
        bevel: hexAt(center, size - size * CRISP.bevel),
        hatch: wall ? hexAt(center, size - size * CRISP.wall) : '',
        center,
      }
    })
    .sort((a, b) => (a.zone === 'void' ? 0 : 1) - (b.zone === 'void' ? 0 : 1))
})

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
      // The crisp look clips the portrait under the rim, inside the frame.
      inner: hexAt(geometry.value.centers.get(unit.hexId)!, hexSize - hexSize * CRISP.inset),
    })),
)

const ringedUnits = computed(() => placedUnits.value.filter((unit) => unit.highlight))
const spotlit = computed(() => ringedUnits.value.length > 0)

const placedArtifacts = computed(() =>
  ARTIFACT_SIDES.flatMap(({ side, team }) => {
    const value = artifacts?.[side]
    if (value === undefined) return []
    const placeholder = typeof value === 'string' ? undefined : value
    return [
      {
        side,
        image: typeof value === 'string' ? value : undefined,
        label: placeholder?.label,
        title: placeholder?.title,
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
        <polygon :points="crisp ? unit.inner : unit.corners" />
      </clipPath>
      <template v-if="crisp">
        <pattern
          :id="`${uid}-hatch`"
          width="6"
          height="6"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(0, 0, 0, 0.4)" stroke-width="2" />
        </pattern>
        <pattern
          :id="`${uid}-hatch-light`"
          width="6"
          height="6"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(0, 0, 0, 0.22)" stroke-width="2" />
        </pattern>
      </template>
      <clipPath v-for="art in placedArtifacts" :id="`${uid}-a-${art.side}`" :key="art.side">
        <circle :cx="art.center.x" :cy="art.center.y" :r="art.radius" />
      </clipPath>
      <!-- The region is sized off the hex's geometry, so the default 10%
           margin would clip the halo's stroke and blur. -->
      <filter v-if="spotlit" :id="`${uid}-ring-edge`" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur :stdDeviation="hexSize * RING_EDGE_BLUR_RATIO" />
      </filter>
    </defs>

    <template v-if="crisp">
      <template v-for="tile in crispTiles" :key="tile.hexId">
        <polygon
          :points="tile.points"
          :fill="tile.fill"
          :stroke="tile.zone === 'void' ? '#8a8f96' : '#a9afb7'"
          :stroke-width="1"
          stroke-linejoin="round"
          vector-effect="non-scaling-stroke"
        />
        <polygon
          v-if="tile.wall"
          :points="tile.hatch"
          :fill="`url(#${uid}-hatch${tile.zone === 'breakable' ? '-light' : ''})`"
        />
        <polygon
          v-if="tile.zone !== 'void'"
          :points="tile.bevel"
          fill="none"
          stroke="rgba(0, 0, 0, 0.5)"
          stroke-width="1"
          vector-effect="non-scaling-stroke"
        />
      </template>
    </template>
    <!-- Opaque so shared edges don't double-composite darker; a step below the
         live grid's #ccc because hairlines need more contrast at this scale. -->
    <polygon
      v-for="tile in renderTiles"
      v-else
      :key="tile.hexId"
      :points="tile.points"
      :fill="tile.fill"
      stroke="#aaa"
      stroke-width="1"
    />

    <g
      v-for="unit in placedUnits"
      :key="`unit-${unit.hexId}`"
      :class="{ faded: spotlit && !unit.highlight }"
    >
      <title v-if="unit.title">{{ unit.title }}</title>
      <template v-if="unit.image && crisp">
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
          :points="unit.inner"
          fill="none"
          stroke="rgba(0, 0, 0, 0.6)"
          stroke-width="1"
          vector-effect="non-scaling-stroke"
        />
        <polygon
          :points="unit.corners"
          fill="none"
          :stroke="unit.color"
          stroke-width="1.5"
          stroke-linejoin="round"
          vector-effect="non-scaling-stroke"
        />
      </template>
      <template v-else-if="unit.image">
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
        <!-- Multi-char labels ("S7", and "S10"+ once seasons hit two digits)
             shrink to fit the dot. -->
        <text
          :x="unit.center.x"
          :y="unit.center.y"
          fill="#fff"
          :font-size="unit.label ? hexSize * (unit.label.length > 2 ? 0.5 : 0.62) : hexSize * 0.8"
          font-weight="700"
          font-family="sans-serif"
          text-anchor="middle"
          dominant-baseline="central"
        >
          {{ unit.label ?? '?' }}
        </text>
      </template>
    </g>

    <g v-for="art in placedArtifacts" :key="`artifact-${art.side}`" :class="{ faded: spotlit }">
      <title v-if="art.title">{{ art.title }}</title>
      <image
        v-if="art.image"
        :href="art.image"
        :x="art.center.x - art.radius"
        :y="art.center.y - art.radius"
        :width="art.radius * 2"
        :height="art.radius * 2"
        preserveAspectRatio="xMidYMid slice"
        :clip-path="`url(#${uid}-a-${art.side})`"
      />
      <!-- Literal grey, not a token: exports serialize the SVG standalone. -->
      <circle v-else :cx="art.center.x" :cy="art.center.y" :r="art.radius" fill="#b0b6bb" />
      <text
        v-if="art.label"
        :x="art.center.x"
        :y="art.center.y"
        fill="#fff"
        :font-size="art.radius * 1.1"
        font-weight="700"
        font-family="sans-serif"
        text-anchor="middle"
        dominant-baseline="central"
      >
        {{ art.label }}
      </text>
      <circle
        :cx="art.center.x"
        :cy="art.center.y"
        :r="art.radius"
        fill="none"
        :stroke="art.color"
        stroke-width="1"
      />
    </g>

    <!-- A layer of their own: drawn inside its unit's group, a ring would lose
         its outer half under neighbors painted after it. -->
    <template v-for="unit in ringedUnits" :key="`ring-${unit.hexId}`">
      <polygon
        class="ring-edge"
        :points="unit.corners"
        fill="none"
        stroke-linejoin="round"
        :stroke-width="hexSize * RING_EDGE_RATIO"
        :filter="`url(#${uid}-ring-edge)`"
      />
      <polygon
        class="ring"
        :points="unit.corners"
        fill="none"
        stroke-linejoin="round"
        :stroke-width="hexSize * RING_RATIO"
      />
    </template>
  </svg>
</template>

<style scoped>
/* The search marks get their stroke color and opacity only from this sheet:
   the card export (useThumbnailExport) serializes the SVG without page
   styles, so it captures the plain team. */
.faded {
  opacity: 0.35;
}

.ring {
  stroke: var(--color-warning);
}

.ring-edge {
  stroke: rgba(0, 0, 0, 0.45);
}
</style>
