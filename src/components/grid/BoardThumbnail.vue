<script lang="ts">
import { computed, useId, useTemplateRef } from 'vue'

import TileHatchPatterns from './TileHatchPatterns.vue'
import { artifactHostHex, Grid } from '@/lib/grid'
import { Layout, POINTY, type Point } from '@/lib/layout'
import { getMapByKey } from '@/lib/maps'
import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'
import {
  BEVEL_INSET,
  getTileHatchPoints,
  getWallHatchFill,
  TEAM_COLORS,
  UNIT_FRAME_COLORS,
} from '@/utils/tileStateFormatting'

/* One unit on a thumbnail: a portrait clipped to its hex, or a team-colored
   dot when the unit is unresolvable: "?" by default, or the caller's label
   (retired seasonal content shows its season, e.g. "S7"). */
export interface ThumbnailUnit {
  hexId: number
  team: Team
  image?: string
  label?: string
  title?: string
  // Ringed; a ringed unit or artifact fades the board's other ones.
  highlight?: boolean
  // Ringed in blue instead of amber: the one the other rings are for.
  focus?: boolean
  // Drawn fainter than the units a ring fades: one leaving the board.
  leaving?: boolean
  // Opens something on hover or tap, so it shows a hand cursor.
  interactive?: boolean
}

// An artifact slot: its image, or a labeled placeholder circle.
export interface ThumbnailArtifact {
  image?: string
  label?: string
  title?: string
  highlight?: boolean
  focus?: boolean
  interactive?: boolean
}

interface Geometry {
  viewBox: string
  points: Map<number, string>
  hatches: Map<number, string>
  centers: Map<number, Point>
  // `zonedTiles` walks `centers`, so an artifact cell listed there would draw
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
  const hatches = new Map<number, string>()
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
    hatches.set(hex.getId(), getTileHatchPoints(corners))
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
    hatches,
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

const CRISP_INSET = 1.6 / 18
type Zone = 'void' | 'ally' | 'enemy' | 'blocked' | 'breakable'
function zoneOf(state: State | undefined): Zone {
  switch (state) {
    // Portraits are partially transparent, so occupied tiles still need their
    // zone's backing.
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
// bright portraits alike without a hard outline. A board drawn large reads a
// much thinner one.
const RINGS = {
  bold: { ring: 0.3, edge: 0.5, blur: 0.08 },
  fine: { ring: 0.1, edge: 0.2, blur: 0.04 },
}

// Inside the tile's border and bevel, which would hide the dashes.
const OUTLINE_INSET = 4.5 / 18

// Tile numbers sit in the hex's lower half on a dark halo, so they read over
// portraits and pale tiles alike.
const NUMBER_DROP_RATIO = 0.48
const NUMBER_SIZE_RATIO = 0.5
const NUMBER_HALO_RATIO = 0.16

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
  numbered = false,
  outlined = [],
  better = [],
  fineRing = false,
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
  // The report's board style.
  crisp?: boolean
  // Each tile's number, low in the hex so a portrait's face stays clear.
  numbered?: boolean
  // Tiles drawn with a dashed outline, and with a solid green one.
  outlined?: number[]
  better?: number[]
  fineRing?: boolean
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

// At card size the hatch is noise, so only the crisp look uses it.
const hatchedTiles = computed(() =>
  crisp
    ? [...geometry.value.hatches.entries()].flatMap(([hexId, points]) => {
        const state = states.value.get(hexId)
        const fill = state === undefined ? null : getWallHatchFill(uid, state)
        return fill ? [{ hexId, points, fill }] : []
      })
    : [],
)

// Open ground first, then every other tile, so a shared edge always shows the
// brighter border.
const zonedTiles = computed(() =>
  [...geometry.value.centers.entries()]
    .map(([hexId, center]) => ({
      hexId,
      zone: zoneOf(states.value.get(hexId)),
      points: geometry.value.points.get(hexId)!,
      bevel: crisp ? hexAt(center, hexSize - hexSize * BEVEL_INSET) : undefined,
    }))
    .sort((a, b) => (a.zone === 'void' ? 0 : 1) - (b.zone === 'void' ? 0 : 1)),
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
      color: TEAM_COLORS[unit.team],
      frame: UNIT_FRAME_COLORS[unit.team],
      imageSize: hexSize * 2.2,
      // The crisp look clips the portrait under the rim, inside the frame.
      inner: hexAt(geometry.value.centers.get(unit.hexId)!, hexSize - hexSize * CRISP_INSET),
    })),
)

const outlinedTiles = computed(() =>
  [
    ...outlined.map((hexId) => ({ hexId, better: false })),
    ...better.map((hexId) => ({ hexId, better: true })),
  ].flatMap(({ hexId, better }) => {
    const center = geometry.value.centers.get(hexId)
    return center
      ? [
          {
            hexId,
            better,
            tile: geometry.value.points.get(hexId)!,
            inner: hexAt(center, hexSize * (1 - OUTLINE_INSET)),
          },
        ]
      : []
  }),
)

const placedArtifacts = computed(() =>
  ARTIFACT_SIDES.flatMap(({ side, team }) => {
    const value = artifacts?.[side]
    if (value === undefined) return []
    return [
      {
        ...value,
        side,
        center: geometry.value.artifactCenters[side],
        radius: hexSize * ARTIFACT_RADIUS_RATIO,
        color: TEAM_COLORS[team],
      },
    ]
  }),
)

const ringSize = computed(() => {
  const ratios = RINGS[fineRing ? 'fine' : 'bold']
  return {
    width: hexSize * ratios.ring,
    edge: hexSize * ratios.edge,
    blur: hexSize * ratios.blur,
  }
})

const isLit = (item: { highlight?: boolean; focus?: boolean }) => !!(item.highlight || item.focus)

// A focus ring comes last, so it keeps an edge it shares with an amber one.
const rings = computed(() =>
  [
    ...placedUnits.value.filter(isLit).map((unit) => ({
      key: `unit-${unit.hexId}`,
      focus: !!unit.focus,
      tag: 'polygon' as const,
      shape: { points: unit.corners },
    })),
    ...placedArtifacts.value.filter(isLit).map((art) => ({
      key: `artifact-${art.side}`,
      focus: !!art.focus,
      tag: 'circle' as const,
      shape: { cx: art.center.x, cy: art.center.y, r: art.radius },
    })),
  ].sort((a, b) => Number(a.focus) - Number(b.focus)),
)
const spotlit = computed(() => rings.value.length > 0)

const svgEl = useTemplateRef<SVGSVGElement>('svg')

// The box on screen round a side's tiles, for a popup kept clear of them.
function zoneBox(zone: 'ally' | 'enemy'): DOMRect | undefined {
  const toScreen = svgEl.value?.getScreenCTM()
  const centers = zonedTiles.value
    .filter((tile) => tile.zone === zone)
    .map((tile) => geometry.value.centers.get(tile.hexId)!)
  if (!toScreen || !centers.length) return undefined
  const halfWidth = (hexSize * Math.sqrt(3)) / 2
  const xs = centers.map((center) => center.x)
  const ys = centers.map((center) => center.y)
  const from = new DOMPoint(Math.min(...xs) - halfWidth, Math.min(...ys) - hexSize)
  const to = new DOMPoint(Math.max(...xs) + halfWidth, Math.max(...ys) + hexSize)
  const a = from.matrixTransform(toScreen)
  const b = to.matrixTransform(toScreen)
  return new DOMRect(a.x, a.y, b.x - a.x, b.y - a.y)
}

defineExpose({ zoneBox })
</script>

<template>
  <svg ref="svg" :viewBox="geometry.viewBox">
    <defs>
      <!-- Clip paths only for occupied hexes, not all 45 tiles. -->
      <clipPath v-for="unit in placedUnits" :id="`${uid}-u-${unit.hexId}`" :key="unit.hexId">
        <polygon :points="crisp ? unit.inner : unit.corners" />
      </clipPath>
      <TileHatchPatterns v-if="hatchedTiles.length" :id="uid" :hex-size="hexSize" />
      <clipPath v-for="art in placedArtifacts" :id="`${uid}-a-${art.side}`" :key="art.side">
        <circle :cx="art.center.x" :cy="art.center.y" :r="art.radius" />
      </clipPath>
      <!-- The region is sized off the hex's geometry, so the default 10%
           margin would clip the halo's stroke and blur. -->
      <filter v-if="spotlit" :id="`${uid}-ring-edge`" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur :stdDeviation="ringSize.blur" />
      </filter>
    </defs>

    <template v-if="crisp">
      <template v-for="tile in zonedTiles" :key="tile.hexId">
        <polygon
          :class="`tile tile-${tile.zone}`"
          :points="tile.points"
          :stroke-width="1"
          stroke-linejoin="round"
          vector-effect="non-scaling-stroke"
        />
        <polygon
          v-if="tile.zone !== 'void'"
          class="tile-bevel"
          :points="tile.bevel"
          fill="none"
          stroke-width="1"
          vector-effect="non-scaling-stroke"
        />
      </template>
    </template>
    <!-- Opaque so shared edges don't double-composite darker. -->
    <polygon
      v-for="tile in zonedTiles"
      v-else
      :key="tile.hexId"
      :class="`card-tile card-${tile.zone}`"
      :points="tile.points"
      stroke-width="1"
    />
    <polygon
      v-for="tile in hatchedTiles"
      :key="`hatch-${tile.hexId}`"
      :points="tile.points"
      :fill="tile.fill"
    />
    <template v-for="tile in outlinedTiles" :key="`outline-${tile.hexId}`">
      <polygon class="outlined-fill" :class="{ better: tile.better }" :points="tile.tile" />
      <polygon
        class="outlined"
        :class="{ better: tile.better }"
        :points="tile.inner"
        stroke-linejoin="round"
        vector-effect="non-scaling-stroke"
      />
    </template>

    <g
      v-for="unit in placedUnits"
      :key="`unit-${unit.hexId}`"
      :class="{
        faded: spotlit && !isLit(unit),
        leaving: unit.leaving,
        interactive: unit.interactive,
      }"
      :data-hex="unit.hexId"
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
          class="unit-frame"
          :points="unit.corners"
          fill="none"
          :style="{ stroke: unit.frame }"
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
        <polygon
          :points="unit.corners"
          fill="none"
          :style="{ stroke: unit.frame }"
          stroke-width="1"
        />
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

    <g
      v-for="art in placedArtifacts"
      :key="`artifact-${art.side}`"
      :class="{ faded: spotlit && !isLit(art), interactive: art.interactive }"
      :data-artifact="art.side"
    >
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

    <template v-if="numbered">
      <text
        v-for="[hexId, center] in geometry.centers"
        :key="`number-${hexId}`"
        class="tile-number"
        :x="center.x"
        :y="center.y + hexSize * NUMBER_DROP_RATIO"
        :font-size="hexSize * NUMBER_SIZE_RATIO"
        :stroke-width="hexSize * NUMBER_HALO_RATIO"
        text-anchor="middle"
        dominant-baseline="central"
      >
        {{ hexId }}
      </text>
    </template>

    <!-- Layers of their own: inside its unit's group a ring would lose its outer
         half under neighbors painted after it, and with every halo under every
         ring, neighboring rings share an edge with no halo across it. -->
    <component
      :is="item.tag"
      v-for="item in rings"
      :key="`edge-${item.key}`"
      v-bind="item.shape"
      class="ring-edge"
      fill="none"
      stroke-linejoin="round"
      :stroke-width="ringSize.edge"
      :filter="`url(#${uid}-ring-edge)`"
    />
    <component
      :is="item.tag"
      v-for="item in rings"
      :key="`ring-${item.key}`"
      v-bind="item.shape"
      :class="['ring', { focus: item.focus }]"
      fill="none"
      stroke-linejoin="round"
      :stroke-width="ringSize.width"
    />
  </svg>
</template>

<style scoped>
.faded {
  opacity: 0.35;
}

.leaving {
  opacity: 0.2;
}

.interactive {
  cursor: pointer;
}

.ring {
  stroke: var(--color-warning);
}

.ring.focus {
  stroke: var(--color-info);
}

.outlined {
  fill: none;
  stroke: var(--placement-also-fine);
  stroke-width: 2;
  stroke-dasharray: 4 3;
}

.outlined.better {
  stroke: var(--placement-better);
  stroke-width: 2.5;
  stroke-dasharray: none;
}

.outlined-fill {
  fill: var(--placement-also-fine);
  fill-opacity: 0.12;
}

.outlined-fill.better {
  fill: var(--placement-better);
  fill-opacity: 0.2;
}

.ring-edge {
  stroke: rgba(0, 0, 0, 0.45);
}

.tile {
  stroke: var(--tile-crisp-stroke);
}

.tile-void {
  fill: var(--tile-crisp-fill-void);
  stroke: var(--tile-crisp-stroke-void);
}

.tile-ally {
  fill: var(--tile-crisp-fill-ally);
}

.tile-enemy {
  fill: var(--tile-crisp-fill-enemy);
}

.tile-blocked {
  fill: var(--tile-crisp-fill-blocked);
}

.tile-breakable {
  fill: var(--tile-crisp-fill-breakable);
}

.tile-bevel {
  stroke: var(--tile-bevel);
}

.card-tile {
  stroke: var(--tile-stroke);
}

.card-void {
  fill: var(--tile-card-fill-void);
  stroke: var(--tile-card-stroke-void);
}

.card-ally {
  fill: var(--tile-card-fill-ally);
}

.card-enemy {
  fill: var(--tile-card-fill-enemy);
}

.card-blocked {
  fill: var(--tile-card-fill-blocked);
}

.card-breakable {
  fill: var(--tile-card-fill-breakable);
}

.tile-number {
  fill: var(--tile-number);
  stroke: rgba(0, 0, 0, 0.75);
  paint-order: stroke;
  font-family: sans-serif;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  pointer-events: none;
}
</style>
