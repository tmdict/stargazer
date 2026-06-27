<script setup lang="ts">
import { computed, ref } from 'vue'

import ArtifactImage from '@/components/ArtifactImage.vue'
import ArtifactSelectionPopup from '@/components/ArtifactSelectionPopup.vue'
import ArtifactTooltip from '@/components/ArtifactTooltip.vue'
import { useGridContext } from '@/composables/useGridContext'
import { useGridHoverTooltip } from '@/composables/useGridHoverTooltip'
import { useSelectionState } from '@/composables/useSelectionState'
import { Hex } from '@/lib/hex'
import type { ArtifactType } from '@/lib/types/artifact'
import { Team } from '@/lib/types/team'
import { useGameDataStore } from '@/stores/gameData'
import { useGrids, type ArtifactDragPayload } from '@/stores/grids'
import { svgPointToScreen } from '@/utils/gridScreenPosition'
import { invertTeam } from '@/utils/tileStateFormatting'

const props = defineProps<{
  allyArtifactId?: number | null
  enemyArtifactId?: number | null
  showPerspective?: boolean
  scaleY?: number
  readonly?: boolean
  isMapEditorMode?: boolean
  // Force tap-to-sheet vs the desktop popup; omit to derive from grid scale.
  tapMode?: boolean
}>()

const ctx = useGridContext()
const gameDataStore = useGameDataStore()
const grids = useGrids()
const { setArtifactTarget, requestTab } = useSelectionState()

// Hover tooltip: the same artifact card as the roster, shown only on a still hover.
// Native HTML5 drag suppresses mouse events, so it can't appear mid-drag; the click
// and dragstart handlers also dismiss it, and it clears on any artifact change.
const {
  hoveredEl,
  hovered: hoveredArtifact,
  show,
  hide: hideArtifactTooltip,
} = useGridHoverTooltip<ArtifactType>(() => [props.allyArtifactId, props.enemyArtifactId])

const showArtifactTooltip = (event: MouseEvent, artifact: ArtifactType | null) => {
  if (!props.readonly) show(event, artifact)
}

// This board's host-cell SVG, used to anchor the artifact popup to the clicked
// board (its coordinate space matches the layout, like GridTiles).
const cellLayerRef = ref<SVGSVGElement | null>(null)

// Purely-visual host cells: the left/right neighbours of real cells 1 (ally) and
// 45 (enemy). Not part of the grid simulation (no tile, pathfinding, or drop
// target): just an SVG outline + the icon, tracking the layout/scale.
const ghostCell = (baseId: number, direction: number): Hex | null => {
  try {
    return ctx.grid.getHexById(baseId).neighbor(direction)
  } catch {
    return null
  }
}
const allyCellHex = computed(() => ghostCell(1, 4)) // direction 4 = left of cell 1
const enemyCellHex = computed(() => ghostCell(45, 1)) // direction 1 = right of cell 45

const cellCenter = (hex: Hex | null) => (hex ? ctx.layout.hexToPixel(hex) : { x: 0, y: 0 })
const cellPoints = (hex: Hex | null) =>
  hex
    ? ctx.layout
        .polygonCorners(hex)
        .map((p) => `${p.x},${p.y}`)
        .join(' ')
    : ''

const allyCenter = computed(() => cellCenter(allyCellHex.value))
const enemyCenter = computed(() => cellCenter(enemyCellHex.value))
const allyCellPoints = computed(() => cellPoints(allyCellHex.value))
const enemyCellPoints = computed(() => cellPoints(enemyCellHex.value))

// The cell-outline SVG shares the full grid box and coordinate space with GridTiles,
// so it compresses with the perspective wrapper exactly like the real hexes.
const gridPixelSize = computed(() => 600 * ctx.hexScale)
// Match the tile stroke (GridTiles' BASE_STROKE_WIDTH) so a covering tile border
// fully hides the dash on a shared edge.
const cellStrokeWidth = computed(() => Math.max(1, 2 * ctx.hexScale))
const cellDashArray = computed(() => {
  const scale = ctx.hexScale
  return `${6 * scale},${4 * scale}`
})

// Artifact icon geometry (at 40px hex radius). Icons are full-bleed square art
// that fills the circle; only the container scales with the breakpoint.
const BASE_ARTIFACT_SIZE = 52

const artifactDimensions = computed(() => {
  const scale = ctx.hexScale
  return {
    containerSize: BASE_ARTIFACT_SIZE * scale,
    borderWidth: Math.max(2, 2 * scale),
  }
})

// Center the icon on its host cell. In perspective, lift it and counter-scale
// vertically (the same transform GridCharacters applies) so it reads as an
// isometric token standing in the cell while the cell beneath it compresses.
const iconStyle = (center: { x: number; y: number }) => {
  const { containerSize, borderWidth } = artifactDimensions.value
  const styles: Record<string, string | number> = {
    width: `${containerSize}px`,
    height: `${containerSize}px`,
    '--artifact-border-width': `${borderWidth}px`,
    left: `${center.x - containerSize / 2}px`,
    top: `${center.y - containerSize / 2}px`,
  }
  if (props.showPerspective) {
    const verticalOffset = -70 * ctx.hexScale
    styles.transform = `translateY(${verticalOffset}px) scaleY(${props.scaleY || 1.0})`
  }
  return styles
}

const getAllyStyles = computed(() => iconStyle(allyCenter.value))
const getEnemyStyles = computed(() => iconStyle(enemyCenter.value))

// Resolve artifact IDs to records (name + season drive local vs remote icons).
const allyArtifact = computed(() => {
  if (props.allyArtifactId === null || props.allyArtifactId === undefined) return null
  return gameDataStore.getArtifactById(props.allyArtifactId) ?? null
})

const enemyArtifact = computed(() => {
  if (props.enemyArtifactId === null || props.enemyArtifactId === undefined) return null
  return gameDataStore.getArtifactById(props.enemyArtifactId) ?? null
})

// Each host cell stays anchored to its engine team, but its displayed team follows
// invert: the slot shown as ally renders in front and is the one kept in team view.
const allySlotDisplayTeam = computed(() => invertTeam(Team.ALLY, ctx.inverted))
const enemySlotDisplayTeam = computed(() => invertTeam(Team.ENEMY, ctx.inverted))
const allySlotInFront = computed(() => allySlotDisplayTeam.value === Team.ALLY)
const enemySlotInFront = computed(() => enemySlotDisplayTeam.value === Team.ALLY)
const allySlotVisible = computed(() => !ctx.teamView || allySlotDisplayTeam.value === Team.ALLY)
const enemySlotVisible = computed(() => !ctx.teamView || enemySlotDisplayTeam.value === Team.ALLY)

// The empty dashed cell is an "add artifact here" affordance, shown only on the
// interactive grid; a filled cell always frames its artifact. A slot shown as
// enemy is hidden in team view.
const showPlaceholders = computed(() => !props.readonly && !props.isMapEditorMode)
const showAllyCell = computed(
  () => allySlotVisible.value && (!!allyArtifact.value || showPlaceholders.value),
)
const showEnemyCell = computed(
  () => enemySlotVisible.value && (!!enemyArtifact.value || showPlaceholders.value),
)

// An empty host cell opens the artifact picker; a filled cell's icon handles
// removal (handleArtifactClick), mirroring the character flow (empty hex → picker,
// placed hero → remove).
const allyCellClickable = computed(
  () => showPlaceholders.value && allySlotVisible.value && !allyArtifact.value,
)
const enemyCellClickable = computed(
  () => showPlaceholders.value && enemySlotVisible.value && !enemyArtifact.value,
)

const showPopup = ref(false)
const popupTeam = ref<Team | null>(null)
const popupPosition = ref({ x: 0, y: 0 })

const openPopup = (team: Team, center: { x: number; y: number }) => {
  const scale = ctx.hexScale
  // Tap-to-sheet (mobile / small grids) vs the desktop popup; the page can force
  // the popup (5 v 5 boards are small but use the on-grid popup).
  if (props.tapMode ?? scale < 1) {
    setArtifactTarget(team)
    requestTab('seasonal')
    return
  }
  const screen = svgPointToScreen(center, cellLayerRef.value)
  if (!screen) return
  popupPosition.value = { x: screen.x + 30 * scale, y: screen.y - 50 * scale }
  popupTeam.value = team
  showPopup.value = true
}

const closePopup = () => {
  showPopup.value = false
  popupTeam.value = null
}

const handleArtifactClick = (team: Team) => {
  hideArtifactTooltip()
  ctx.removeArtifact(team)
}

// Artifact drag-and-drop. A filled icon is the drag source; an empty cell polygon
// and a filled icon are the drop targets (the two-surface split mirrors the existing
// click affordances). Move/swap routing and per-team uniqueness live in
// grids.routeArtifactDrop; a distinct MIME plus stopPropagation keeps this off the
// character drop pipeline. Desktop-only, interactive boards only.
const ARTIFACT_MIME = 'application/artifact'

const canDrag = computed(() => showPlaceholders.value && !(props.tapMode ?? ctx.hexScale < 1))
const allyDroppable = computed(() => canDrag.value && allySlotVisible.value && !allyArtifact.value)
const enemyDroppable = computed(
  () => canDrag.value && enemySlotVisible.value && !enemyArtifact.value,
)

// team is the cell's fixed engine team (Team.ALLY / Team.ENEMY), never the
// invert-derived display team; invert flips rendering only.
const handleArtifactDragStart = (event: DragEvent, team: Team) => {
  hideArtifactTooltip()
  if (!canDrag.value || !event.dataTransfer) return
  const payload: ArtifactDragPayload = { sourceCtxId: ctx.id, sourceTeam: team }
  event.dataTransfer.setData(ARTIFACT_MIME, JSON.stringify(payload))
  event.dataTransfer.effectAllowed = 'move'
}

const allowArtifactDrop = (event: DragEvent) => {
  if (canDrag.value && event.dataTransfer?.types.includes(ARTIFACT_MIME)) event.preventDefault()
}

const handleArtifactDrop = (event: DragEvent, targetTeam: Team) => {
  const raw = event.dataTransfer?.getData(ARTIFACT_MIME)
  if (!raw || !canDrag.value) return
  event.stopPropagation()
  event.preventDefault()
  grids.routeArtifactDrop(JSON.parse(raw) as ArtifactDragPayload, ctx.id, targetTeam)
}
</script>

<template>
  <div class="grid-artifacts">
    <!-- Dashed border as a full hexagon beneath the tiles (z-index: -1): each
         rendered neighbor's solid border covers the shared edge, and the dash shows
         wherever no tile is drawn beside it (e.g. team view hides the neighbor). The
         fill/click layer below stays above the tiles; it's the off-grid host cell and
         never overlaps one. -->
    <svg
      v-if="showAllyCell || showEnemyCell"
      class="artifact-cell-border-layer"
      :width="gridPixelSize"
      :height="gridPixelSize"
    >
      <polygon
        v-if="showAllyCell"
        class="artifact-cell-border"
        fill="none"
        :points="allyCellPoints"
        :stroke-width="cellStrokeWidth"
        :stroke-dasharray="cellDashArray"
      />
      <polygon
        v-if="showEnemyCell"
        class="artifact-cell-border"
        fill="none"
        :points="enemyCellPoints"
        :stroke-width="cellStrokeWidth"
        :stroke-dasharray="cellDashArray"
      />
    </svg>

    <!-- Host-cell fill + click target. Same coordinate space as GridTiles. -->
    <svg
      v-if="showAllyCell || showEnemyCell"
      ref="cellLayerRef"
      class="artifact-cell-layer"
      :width="gridPixelSize"
      :height="gridPixelSize"
    >
      <polygon
        v-if="showAllyCell"
        class="artifact-cell"
        fill="transparent"
        :class="{ clickable: allyCellClickable, droppable: allyDroppable }"
        :points="allyCellPoints"
        @click="allyCellClickable && openPopup(Team.ALLY, allyCenter)"
        @dragover="allowArtifactDrop"
        @drop="handleArtifactDrop($event, Team.ALLY)"
      />
      <polygon
        v-if="showEnemyCell"
        class="artifact-cell"
        fill="transparent"
        :class="{ clickable: enemyCellClickable, droppable: enemyDroppable }"
        :points="enemyCellPoints"
        @click="enemyCellClickable && openPopup(Team.ENEMY, enemyCenter)"
        @dragover="allowArtifactDrop"
        @drop="handleArtifactDrop($event, Team.ENEMY)"
      />
    </svg>

    <!-- Ally artifact (host cell: left of cell 1). `front` lifts it above the
         character layer so the lifted icon isn't covered in perspective; it tracks
         the slot shown as ally. -->
    <div
      v-if="allyArtifact && allySlotVisible"
      class="grid-artifact"
      :class="{ readonly, front: allySlotInFront }"
      :style="getAllyStyles"
      :draggable="canDrag"
      @click="!readonly && handleArtifactClick(Team.ALLY)"
      @dragstart="handleArtifactDragStart($event, Team.ALLY)"
      @dragover="allowArtifactDrop"
      @drop="handleArtifactDrop($event, Team.ALLY)"
      @mouseenter="showArtifactTooltip($event, allyArtifact)"
      @mouseleave="hideArtifactTooltip"
    >
      <div class="artifact-circle">
        <ArtifactImage :artifact="allyArtifact" />
      </div>
      <div v-if="showPerspective" class="artifact-pointer" />
    </div>

    <!-- Enemy artifact (host cell: right of cell 45). Behind the character layer
         (DOM order) unless invert shows this slot as ally, when it lifts to front. -->
    <div
      v-if="enemyArtifact && enemySlotVisible"
      class="grid-artifact"
      :class="{ readonly, front: enemySlotInFront }"
      :style="getEnemyStyles"
      :draggable="canDrag"
      @click="!readonly && handleArtifactClick(Team.ENEMY)"
      @dragstart="handleArtifactDragStart($event, Team.ENEMY)"
      @dragover="allowArtifactDrop"
      @drop="handleArtifactDrop($event, Team.ENEMY)"
      @mouseenter="showArtifactTooltip($event, enemyArtifact)"
      @mouseleave="hideArtifactTooltip"
    >
      <div class="artifact-circle">
        <ArtifactImage :artifact="enemyArtifact" />
      </div>
      <div v-if="showPerspective" class="artifact-pointer" />
    </div>

    <ArtifactTooltip
      v-if="hoveredEl && hoveredArtifact"
      :artifact="hoveredArtifact"
      :target-element="hoveredEl"
      variant="detailed"
    />

    <Teleport to="body">
      <ArtifactSelectionPopup
        v-if="showPopup && popupTeam !== null"
        :team="popupTeam"
        :position="popupPosition"
        @close="closePopup"
      />
    </Teleport>
  </div>
</template>

<style scoped>
.grid-artifacts {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  /* Host cells sit just past the grid's left/right edges; clip x only (y stays
     visible for perspective-lifted icons) so they can't cause horizontal page
     overflow if the grid is ever transiently mis-scaled. */
  overflow-x: clip;
}

.artifact-cell-layer,
.artifact-cell-border-layer {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  overflow: visible;
}

/* Beneath the in-flow tile layer so tiles cover shared edges (see template).
   .grid-map sets isolation: isolate so this z-index can't escape the board. */
.artifact-cell-border-layer {
  z-index: -1;
}

.artifact-cell {
  /* Paired with a transparent `fill` attribute in the template: PNG export drops
     scoped CSS, so without it the polygon falls back to SVG's default black fill. */
  fill: rgba(255, 255, 255, 0.06);
}

.artifact-cell-border {
  stroke: var(--color-text-tertiary, #8a8f98);
}

/* Empty host cells invite a click to open the artifact picker. */
.artifact-cell.clickable {
  pointer-events: auto;
  cursor: pointer;
  transition: fill 0.15s ease;
}

.artifact-cell.clickable:hover {
  fill: rgba(255, 255, 255, 0.16);
}

/* An empty cell receives drops via its polygon; a filled cell via its icon (which
   already has pointer-events: auto). On an interactive empty cell .droppable and
   .clickable coincide by construction. */
.artifact-cell.droppable {
  pointer-events: auto;
}

.grid-artifact {
  position: absolute;
  cursor: pointer;
  pointer-events: auto;
  transform-origin: center;
  /* Always present (not inline-only) so the perspective<->flat transform animates
     in both directions, in sync with the grid + character icons. */
  transition: transform 0.3s ease-out;
}

/* Ally artifact paints above the character layer (which is a later sibling). */
.grid-artifact.front {
  z-index: 2;
}

.grid-artifact.readonly {
  cursor: default;
}

/* The circular, clipped visual. The wrapper stays overflow-visible so the
   perspective pointer can extend below it. */
.artifact-circle {
  width: 100%;
  height: 100%;
  border-radius: var(--radius-round);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: var(--artifact-border-width, 2px) solid var(--color-bg-white);
  box-shadow: 0 0 0 2px #fff;
  /* White backing for every season (icons may have transparency). */
  background: #fff;
}

/* Mirrors GridCharacters' .character-pointer: the isometric "foot" in perspective. */
.artifact-pointer {
  position: absolute;
  bottom: -8px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 8px solid #777;
}
</style>
