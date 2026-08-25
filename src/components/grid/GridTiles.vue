<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, onUnmounted, ref, watchEffect } from 'vue'

import { useDragDrop } from '@/composables/useDragDrop'
import { useGridContext } from '@/composables/useGridContext'
import { useGridEvents } from '@/composables/useGridEvents'
import { useSelectionState } from '@/composables/useSelectionState'
import { hasCharacter } from '@/lib/characters/character'
import type { Hex } from '@/lib/hex'
import type { Layout } from '@/lib/layout'
import { State } from '@/lib/types/state'
import { useGrids } from '@/stores/grids'
import { useMapEditorStore } from '@/stores/mapEditor'
import { getTileFillColor } from '@/utils/tileStateFormatting'

interface Props {
  hexes: Hex[]
  layout: Layout
  height: number
  showTileIds: boolean
  showCoordinates: boolean
  isMapEditorMode: boolean
  selectedMapEditorState: State
  showPerspective: boolean
  showSkills: boolean
  readonly?: boolean
}

const props = defineProps<Props>()

// Base (unscaled) render constants
const BASE_WIDTH = 600
const BASE_STROKE_WIDTH = 2
const HEX_ID_FONT_SIZE = 18
const COORDINATE_FONT_SIZE = 8
const TEXT_ROTATION = 30
const TEXT_COLOR = '#222'
const COORDINATE_COLOR = '#555'
const HEX_FILL_COLOR = '#fff'
const HEX_STROKE_COLOR = '#ccc'
// Skill fill-paints are blended into one opaque color, not a translucent layer,
// so an exported PNG has no partial alpha for a viewer to composite against its
// own background. Kept below the arrow opacity (0.8); a full-cell tint reads strong.
const SKILL_FILL_RATIO = 0.35

const gridEvents = useGridEvents()

const {
  handleDragOver,
  handleDrop,
  hasCharacterData,
  draggedCharacter,
  hoveredHexId,
  hoveredGridId,
  lastDropHexId,
  lastDropGridId,
  isDragging,
  setHoveredHex,
  setDropHandled,
} = useDragDrop()

// Root SVG, exposed for GridManager's screen→SVG coordinate conversion
const svgEl = ref<SVGSVGElement | null>(null)
defineExpose({ svgEl })
const ctx = useGridContext()
const grids = useGrids()
const mapEditorStore = useMapEditorStore()

// Mobile: the tile tapped to target placement (highlighted until a hero fills it).
// Board-qualified so only this board's tapped tile lights up, not the same hex id
// on every 5 v 5 board.
const { targetHexId, targetGridId, liftedHexId, liftedGridId } = useSelectionState()

// Non-drag hover; drag hover is the shared hoveredHexId.
const hoveredHex = ref<number | null>(null)

// Map editor drag-to-paint: holding the mouse button paints every hex it
// crosses, each once per drag session and at most every PAINT_THROTTLE_MS.
const isMapEditorDragging = ref(false)
const paintedHexes = ref(new Set<number>())
let lastPaintTime = 0
const PAINT_THROTTLE_MS = 50

const textTransform = (hex: Hex) => {
  const pos = ctx.layout.hexToPixel(hex)
  return `rotate(${TEXT_ROTATION},${pos.x},${pos.y})`
}

// Composite `overlay` over `base` at `ratio` (0..1) into an opaque #rrggbb.
// Inputs may be #rgb or #rrggbb.
const mixHexColors = (base: string, overlay: string, ratio: number): string => {
  const toRgb = (hex: string): number[] => {
    const h = hex.replace('#', '')
    const full =
      h.length === 3
        ? h
            .split('')
            .map((c) => c + c)
            .join('')
        : h
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16))
  }
  const b = toRgb(base)
  const o = toRgb(overlay)
  const channel = (i: number) => Math.round(b[i]! * (1 - ratio) + o[i]! * ratio)
  const toHex = (n: number) => n.toString(16).padStart(2, '0')
  return `#${toHex(channel(0))}${toHex(channel(1))}${toHex(channel(2))}`
}

const getHexFill = (hex: Hex) => {
  const state = ctx.grid.getTile(hex).state
  const baseFill = getTileFillColor(state) || HEX_FILL_COLOR
  if (props.showSkills) {
    const fills = ctx.getTileFillModifier(hex.getId())
    if (fills) return mixHexColors(baseFill, fills[0]!, SKILL_FILL_RATIO)
  }
  return baseFill
}

const shouldShowHexId = (hex: Hex) => {
  const state = ctx.grid.getTile(hex).state
  return state !== State.BLOCKED
}

// Hover is suppressed during a drag and for a 100ms grace period after it:
// mouse events fire as soon as isDragging drops and would otherwise flash a
// hover highlight on the drop hex before the drag UI has cleaned up.
const blockHover = ref(false)

const svgDimensions = computed(() => {
  const scale = ctx.hexScale
  return {
    width: BASE_WIDTH * scale,
    height: props.height * scale,
  }
})

const scaledFontSizes = computed(() => {
  const scale = ctx.hexScale
  return {
    hexId: Math.max(10, HEX_ID_FONT_SIZE * scale),
    coordinate: Math.max(6, COORDINATE_FONT_SIZE * scale),
  }
})

const scaledStrokeWidth = computed(() => {
  const scale = ctx.hexScale
  return Math.max(1, BASE_STROKE_WIDTH * scale)
})

let blockHoverTimeout: number | null = null
watchEffect(() => {
  if (isDragging.value) {
    blockHover.value = true
    hoveredHex.value = null
    if (blockHoverTimeout) {
      clearTimeout(blockHoverTimeout)
      blockHoverTimeout = null
    }
  } else if (blockHover.value) {
    blockHoverTimeout = window.setTimeout(() => {
      blockHover.value = false
      // Restore the hover highlight on the drop tile (this board only).
      if (lastDropHexId.value !== null && lastDropGridId.value === ctx.id) {
        hoveredHex.value = lastDropHexId.value
        lastDropHexId.value = null
        lastDropGridId.value = null
      }
      blockHoverTimeout = null
    }, 100)
  }
})

const handleHexMouseEnter = (hex: Hex) => {
  if (!blockHover.value) {
    hoveredHex.value = hex.getId()
  }

  if (props.isMapEditorMode && isMapEditorDragging.value) {
    const hexId = hex.getId()
    const now = Date.now()

    if (!paintedHexes.value.has(hexId) && now - lastPaintTime >= PAINT_THROTTLE_MS) {
      mapEditorStore.setHexState(hexId, props.selectedMapEditorState)
      paintedHexes.value.add(hexId)
      lastPaintTime = now
    }
  }
}

const handleHexMouseLeave = (hex: Hex) => {
  if (hoveredHex.value === hex.getId()) {
    hoveredHex.value = null
  }
}

const handleMapEditorMouseDown = () => {
  if (props.isMapEditorMode) {
    isMapEditorDragging.value = true
    paintedHexes.value.clear()
  }
}

const handleMapEditorMouseUp = () => {
  if (props.isMapEditorMode) {
    isMapEditorDragging.value = false
    paintedHexes.value.clear()
  }
}

onBeforeUnmount(() => {
  isMapEditorDragging.value = false
  paintedHexes.value.clear()
})

// Hybrid drag detection: the tile's own SVG events plus the provider's
// position-based detection, which still sees the hex when a character
// portrait sits over the tile and swallows its events.
const handleHexDragOver = (event: DragEvent, hex: Hex) => {
  if (hasCharacterData(event)) {
    handleDragOver(event)
    setHoveredHex(hex.getId(), ctx.id)
  }
}

const handleHexDragLeave = (_event: DragEvent, hex: Hex) => {
  // Only clear once position detection confirms the pointer left this hex;
  // dragleave also fires when moving onto the portrait above the same tile.
  const currentDetectedHex = hoveredHexId.value
  if (currentDetectedHex !== hex.getId()) {
    setHoveredHex(null)
  }
}

// A tile drop must not also be processed by DragDropProvider's document-level
// drop listener: stopPropagation keeps the event from bubbling there, and
// dropHandled is the provider's own check for the same case.
const handleHexDrop = (event: DragEvent, hex: Hex) => {
  event.stopPropagation()
  event.preventDefault()

  const dropResult = handleDrop(event)
  if (dropResult) {
    setDropHandled(true)
    grids.routeDrop(dropResult, ctx.id, hex.getId())
  }
}

const getHexDropClass = (hex: Hex) => {
  const hexId = hex.getId()
  const isOccupied = hasCharacter(ctx.grid, hexId)
  const isDragHover =
    isDragging.value && hoveredGridId.value === ctx.id && hoveredHexId.value === hexId

  // canDropCharacter is routeDrop's own gate, so the hover cue matches the drop
  // for every routing-layer rejection; per-grid engine rejections and
  // mid-transaction failures still resolve at drop time as silent no-ops.
  let validDropZone = false
  if (isDragHover && draggedCharacter.value) {
    validDropZone = grids.canDropCharacter(
      draggedCharacter.value.id,
      draggedCharacter.value.sourceGridId,
      draggedCharacter.value.sourceHexId,
      ctx.id,
      hexId,
    )
  }

  return {
    'drop-target': true,
    occupied: isOccupied,
    'drag-hover': isDragHover,
    'invalid-drop': isDragHover && !validDropZone,
    hover: hoveredHex.value === hexId,
    targeted: targetHexId.value === hexId && targetGridId.value === ctx.id,
    lifted: liftedHexId.value === hexId && liftedGridId.value === ctx.id,
  }
}

const isElevated = (hex: Hex) => {
  return hasCharacter(ctx.grid, hex.getId())
}

const getHexStroke = (hex: Hex) => {
  const hexId = hex.getId()

  if (props.showSkills) {
    const colors = ctx.getTileColorModifier(hexId)
    if (colors) {
      return colors[0]
    }
  }

  const isOccupied = hasCharacter(ctx.grid, hexId)
  return isOccupied ? '#999' : HEX_STROKE_COLOR
}

const getHexStrokeWidth = (hex: Hex) => {
  const hexId = hex.getId()
  const scale = ctx.hexScale

  if (props.showSkills) {
    const colors = ctx.getTileColorModifier(hexId)
    if (colors) {
      const baseWidth = Math.max(3, 4 * scale)
      const step = Math.max(2, 3 * scale)
      return baseWidth + (colors.length - 1) * step
    }
  }

  const isOccupied = hasCharacter(ctx.grid, hexId)
  return isOccupied ? Math.max(2, 3 * scale) : scaledStrokeWidth.value
}

const getConcentricStrokes = (hex: Hex): Array<{ color: string; width: number }> => {
  if (!props.showSkills) return []
  const colors = ctx.getTileColorModifier(hex.getId())
  if (!colors || colors.length <= 1) return []

  const scale = ctx.hexScale
  const baseWidth = Math.max(3, 4 * scale)
  const step = Math.max(2, 3 * scale)

  // Painted over the outermost stroke, each thinner, so every color shows as a ring.
  return colors.slice(1).map((color, i) => ({
    color,
    width: baseWidth + (colors.length - 2 - i) * step,
  }))
}

const hasSkillHighlight = (hex: Hex) => {
  if (!props.showSkills) return false
  return ctx.getTileColorModifier(hex.getId()) !== undefined
}

// Render layers: SVG has no z-index, so stacking is draw order.
const regularHexes = computed(() =>
  props.hexes.filter((hex) => !isElevated(hex) && !hasSkillHighlight(hex)),
)
const elevatedHexes = computed(() =>
  props.hexes.filter((hex) => isElevated(hex) && !hasSkillHighlight(hex)),
)
const skillHighlightedHexes = computed(() => props.hexes.filter((hex) => hasSkillHighlight(hex)))

const handleCharacterHoverEnter = (hexId: number) => {
  if (!blockHover.value && !props.readonly) {
    hoveredHex.value = hexId
  }
}

const handleCharacterHoverLeave = (hexId: number) => {
  if (hoveredHex.value === hexId && !props.readonly) {
    hoveredHex.value = null
  }
}

onMounted(() => {
  gridEvents.on('character:mouseenter', handleCharacterHoverEnter)
  gridEvents.on('character:mouseleave', handleCharacterHoverLeave)
})

onUnmounted(() => {
  gridEvents.off('character:mouseenter', handleCharacterHoverEnter)
  gridEvents.off('character:mouseleave', handleCharacterHoverLeave)
})
</script>

<template>
  <svg
    ref="svgEl"
    :width="svgDimensions.width"
    :height="svgDimensions.height"
    class="grid-tiles"
    :data-readonly="readonly"
    @mousedown="handleMapEditorMouseDown"
    @mouseup="handleMapEditorMouseUp"
    @mouseleave="handleMapEditorMouseUp"
  >
    <defs>
      <slot name="defs" />
    </defs>
    <g>
      <g>
        <!-- Regular hexes (render first, behind elevated hexes) -->
        <g v-for="hex in regularHexes" :key="hex.getId()" class="grid-tile">
          <polygon
            :points="
              layout
                .polygonCorners(hex)
                .map((p) => `${p.x},${p.y}`)
                .join(' ')
            "
            :fill="getHexFill(hex)"
            :stroke="getHexStroke(hex)"
            :stroke-width="getHexStrokeWidth(hex)"
          />
        </g>

        <!-- Elevated hexes (render above regular hexes, but below skill highlights) -->
        <g v-for="hex in elevatedHexes" :key="`elevated-${hex.getId()}`" class="grid-tile">
          <polygon
            :points="
              layout
                .polygonCorners(hex)
                .map((p) => `${p.x},${p.y}`)
                .join(' ')
            "
            :fill="getHexFill(hex)"
            :stroke="getHexStroke(hex)"
            :stroke-width="getHexStrokeWidth(hex)"
          />
        </g>

        <!-- Skill-highlighted hexes (render on top to ensure skill borders are visible) -->
        <g
          v-for="hex in skillHighlightedHexes"
          :key="`skill-${hex.getId()}`"
          class="grid-tile skill-highlighted"
        >
          <!-- Outermost stroke (first color) -->
          <polygon
            :points="
              layout
                .polygonCorners(hex)
                .map((p) => `${p.x},${p.y}`)
                .join(' ')
            "
            :fill="getHexFill(hex)"
            :stroke="getHexStroke(hex)"
            :stroke-width="getHexStrokeWidth(hex)"
          />
          <!-- Concentric inner strokes for additional colors -->
          <polygon
            v-for="(stroke, idx) in getConcentricStrokes(hex)"
            :key="`stroke-${idx}`"
            :points="
              layout
                .polygonCorners(hex)
                .map((p) => `${p.x},${p.y}`)
                .join(' ')
            "
            fill="none"
            :stroke="stroke.color"
            :stroke-width="stroke.width"
          />
        </g>

        <!-- Text layer (render once for all hexes, on top of all tile polygons) -->
        <g v-for="hex in hexes" :key="`text-${hex.getId()}`" class="hex-text">
          <text
            v-if="showTileIds && shouldShowHexId(hex)"
            :x="ctx.layout.hexToPixel(hex).x"
            :y="ctx.layout.hexToPixel(hex).y + 6"
            text-anchor="middle"
            :font-size="scaledFontSizes.hexId"
            :fill="TEXT_COLOR"
            font-family="monospace"
            :transform="textTransform(hex)"
          >
            {{ hex.getId() }}
          </text>
          <text
            v-if="showCoordinates"
            :x="ctx.layout.hexToPixel(hex).x"
            :y="ctx.layout.hexToPixel(hex).y + 18"
            text-anchor="middle"
            :font-size="scaledFontSizes.coordinate"
            :fill="COORDINATE_COLOR"
            font-family="monospace"
            :transform="textTransform(hex)"
          >
            ({{ hex.q }},{{ hex.r }},{{ hex.s }})
          </text>
        </g>

        <!-- Invisible event layer. Rendered last so it is the topmost SVG layer and
             receives the hover, click, and drop events; the tile polygons above are
             visual only. The HTML character portraits are not under it (they keep
             pointer-events: auto so they can be dragged), so a drag hovering over a
             portrait is resolved by DragDropProvider's position-based hex detection
             instead of by this layer. -->
        <g
          v-for="hex in hexes"
          :key="`event-${hex.getId()}`"
          class="grid-event-layer"
          :class="getHexDropClass(hex)"
        >
          <polygon
            :points="
              layout
                .polygonCorners(hex)
                .map((p) => `${p.x},${p.y}`)
                .join(' ')
            "
            fill="transparent"
            stroke="transparent"
            stroke-width="0"
            @click="!readonly && gridEvents.emit('hex:click', hex, $event)"
            @mouseenter="!readonly && handleHexMouseEnter(hex)"
            @mouseleave="!readonly && handleHexMouseLeave(hex)"
            @dragover="!readonly && handleHexDragOver($event, hex)"
            @dragleave="!readonly && handleHexDragLeave($event, hex)"
            @drop="!readonly && handleHexDrop($event, hex)"
          />
        </g>
      </g>
    </g>
  </svg>
</template>

<style scoped>
.grid-tiles {
  max-width: 100%;
  height: auto;
}

.grid-tile {
  cursor: pointer;
}

.grid-tiles[data-readonly='true'] .grid-tile {
  cursor: default;
}

.hex-text {
  pointer-events: none;
}

.grid-event-layer {
  cursor: pointer;
  pointer-events: all;
}

.grid-tiles[data-readonly='true'] .grid-event-layer {
  cursor: default;
}

.grid-event-layer polygon {
  pointer-events: all;
  transition:
    fill 0.2s ease,
    stroke 0.2s ease,
    stroke-width 0.2s ease;
}

/* Hover overlay: a single neutral tint that lightens any tile color.
   Per-state stroke and drop-shadow below carry the validity signal. */
.grid-event-layer.drop-target.drag-hover polygon,
.grid-event-layer.drop-target:not(.drag-hover).hover polygon {
  fill: rgba(255, 255, 255, 0.3);
  stroke-width: 3;
}

.grid-event-layer.drop-target.drag-hover:not(.occupied):not(.invalid-drop) polygon {
  stroke: #36958e;
  filter: drop-shadow(0 0 8px rgba(76, 175, 80, 0.4));
}

.grid-event-layer.drop-target.drag-hover.occupied:not(.invalid-drop) polygon {
  stroke: #ff9800;
  filter: drop-shadow(0 0 8px rgba(255, 152, 0, 0.4));
}

.grid-event-layer.drop-target.drag-hover.invalid-drop polygon {
  stroke: #c05b4d;
  filter: drop-shadow(0 0 8px rgba(244, 67, 54, 0.4));
}

.grid-event-layer.drop-target:not(.drag-hover).hover polygon {
  stroke: #36958e;
}

/* Mobile: the tile tapped to target placement gets a persistent gold highlight
   until a hero fills it. */
.grid-event-layer.targeted polygon {
  fill: rgba(247, 216, 124, 0.35);
  stroke: #f7d87c;
  stroke-width: 3;
}

/* A lifted hero's source tile, teal so it can't be confused with the gold
   placement target. */
.grid-event-layer.lifted polygon {
  fill: rgba(54, 149, 142, 0.3);
  stroke: #36958e;
  stroke-width: 3;
}
</style>
