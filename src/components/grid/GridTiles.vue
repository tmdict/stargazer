<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, onUnmounted, ref, watchEffect } from 'vue'

import { useDragDrop } from '../../composables/useDragDrop'
import { useGridEvents } from '../../composables/useGridEvents'
import { canPlaceCharacterOnTeam, hasCharacter } from '../../lib/characters/character'
import type { Hex } from '../../lib/hex'
import type { Layout } from '../../lib/layout'
import { State } from '../../lib/types/state'
import { Team } from '../../lib/types/team'
import { useCharacterStore } from '../../stores/character'
import { useGridStore } from '../../stores/grid'
import { useMapEditorStore } from '../../stores/mapEditor'
import { useSkillStore } from '../../stores/skill'
import { getTileFillColor } from '../../utils/tileStateFormatting'

interface Props {
  hexes: Hex[]
  layout: Layout
  width?: number
  height: number
  rotation?: number
  scaleX?: number
  scaleY?: number
  skewX?: number
  skewY?: number
  centerX: number
  centerY: number
  strokeWidth?: number
  showHexIds: boolean
  showCoordinates: boolean
  hexIdFontSize?: number
  coordinateFontSize?: number
  textColor?: string
  coordinateColor?: string
  textRotation?: number
  hexFillColor?: string
  hexStrokeColor?: string
  isMapEditorMode: boolean
  selectedMapEditorState: State
  showPerspective: boolean
  showSkills: boolean
  readonly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  width: 600,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  skewX: 0,
  skewY: 0,
  strokeWidth: 2,
  hexIdFontSize: 18,
  coordinateFontSize: 8,
  textColor: '#222',
  coordinateColor: '#555',
  textRotation: 30,
  hexFillColor: '#fff',
  hexStrokeColor: '#ccc',
})

const gridEvents = useGridEvents()

const {
  handleDragOver,
  handleDrop,
  hasCharacterData,
  draggedCharacter,
  hoveredHexId,
  isDragging,
  setHoveredHex,
  setDropHandled,
} = useDragDrop()
const gridStore = useGridStore()
const characterStore = useCharacterStore()
const mapEditorStore = useMapEditorStore()
const skillStore = useSkillStore()

// Track which hex is currently being hovered (non-drag)
const hoveredHex = ref<number | null>(null)

// Map editor drag-to-paint state
// Enables continuous painting while dragging mouse across hexes
const isMapEditorDragging = ref(false)
const paintedHexes = ref(new Set<number>()) // Tracks painted hexes to avoid duplicates
let lastPaintTime = 0
const PAINT_THROTTLE_MS = 50 // Performance: throttle painting to every 50ms

const gridTransform = computed(() => {
  const transforms: string[] = []
  if (props.rotation !== 0) {
    transforms.push(`rotate(${props.rotation},${props.centerX},${props.centerY})`)
  }
  if (props.skewX !== 0) {
    transforms.push(`skewX(${props.skewX})`)
  }
  if (props.skewY !== 0) {
    transforms.push(`skewY(${props.skewY})`)
  }
  if (props.scaleX !== 1 || props.scaleY !== 1) {
    transforms.push(`scale(${props.scaleX},${props.scaleY})`)
  }
  return transforms.join(' ')
})

const textTransform = (hex: Hex) => {
  if (props.textRotation === 0) return ''
  const pos = gridStore.layout.hexToPixel(hex)
  return `rotate(${props.textRotation},${pos.x},${pos.y})`
}

const getHexFill = (hex: Hex) => {
  const state = gridStore.grid.getTile(hex).state

  return getTileFillColor(state) || props.hexFillColor
}

const shouldShowHexId = (hex: Hex) => {
  const state = gridStore.grid.getTile(hex).state
  return state !== State.BLOCKED
}

// HOVER STATE FIX:
// Problem: After drag ends, hover state would sometimes immediately appear on the hex
// where the drag ended, causing a visual flicker/glitch.
//
// Root Cause: Race condition between drag end and mouse events. When drag ends,
// isDragging becomes false, but mouse events can fire immediately, seeing isDragging
// as false and setting hover state before the UI has fully cleaned up.
//
// Solution: Use a blocking flag that stays true during drag AND for 100ms after drag
// ends. This gives the UI time to clean up before allowing hover states again.
//
// Implementation: watchEffect monitors isDragging changes and manages a timer that
// keeps blockHover true for a grace period after drag ends.
const blockHover = ref(false)

// Computed SVG dimensions based on hex scale
const svgDimensions = computed(() => {
  const scale = gridStore.getHexScale()
  return {
    width: props.width * scale,
    height: props.height * scale,
  }
})

// Dynamic font sizes
const scaledFontSizes = computed(() => {
  const scale = gridStore.getHexScale()
  return {
    hexId: Math.max(10, props.hexIdFontSize * scale), // Min 10px for readability
    coordinate: Math.max(6, props.coordinateFontSize * scale), // Min 6px
  }
})

// Hide coordinates on mobile for better readability
const shouldShowCoordinates = computed(() => {
  const scale = gridStore.getHexScale()
  // Only show coordinates on desktop (scale = 1)
  return props.showCoordinates && scale >= 1
})

// Dynamic stroke width
const scaledStrokeWidth = computed(() => {
  const scale = gridStore.getHexScale()
  return Math.max(1, props.strokeWidth * scale) // Min 1px
})

// When dragging state changes, manage the block
let blockHoverTimeout: number | null = null
watchEffect(() => {
  if (isDragging.value) {
    // Currently dragging - block hover
    blockHover.value = true
    if (blockHoverTimeout) {
      clearTimeout(blockHoverTimeout)
      blockHoverTimeout = null
    }
  } else if (blockHover.value) {
    // Just stopped dragging - keep blocking for a bit
    blockHoverTimeout = window.setTimeout(() => {
      blockHover.value = false
      blockHoverTimeout = null
    }, 100)
  }
})

// Mouse hover handling functions
const handleHexMouseEnter = (hex: Hex) => {
  // Don't set hover state if we're blocking
  if (!blockHover.value) {
    hoveredHex.value = hex.getId()
  }

  // Map editor drag-to-paint with throttling
  if (props.isMapEditorMode && isMapEditorDragging.value) {
    const hexId = hex.getId()
    const now = Date.now()

    if (!paintedHexes.value.has(hexId) && now - lastPaintTime >= PAINT_THROTTLE_MS) {
      const success = mapEditorStore.setHexState(hexId, props.selectedMapEditorState)
      if (success) {
        paintedHexes.value.add(hexId)
        lastPaintTime = now
      }
    }
  }
}

const handleHexMouseLeave = (hex: Hex) => {
  if (hoveredHex.value === hex.getId()) {
    hoveredHex.value = null
  }
}

// Map editor mouse handlers for drag-to-paint functionality
// Enables painting multiple hexes by holding mouse button and dragging
const handleMapEditorMouseDown = () => {
  if (props.isMapEditorMode) {
    isMapEditorDragging.value = true
    paintedHexes.value.clear() // Reset painted hexes for new drag session
  }
}

const handleMapEditorMouseUp = () => {
  if (props.isMapEditorMode) {
    isMapEditorDragging.value = false
    paintedHexes.value.clear() // Cleanup after drag session
  }
}

// Clean up map editor state on unmount
onBeforeUnmount(() => {
  isMapEditorDragging.value = false
  paintedHexes.value.clear()
})

/**
 * Hybrid drag detection: combines SVG events with position-based detection
 * to handle drops when character portraits block tile events.
 */
const handleHexDragOver = (event: DragEvent, hex: Hex) => {
  if (hasCharacterData(event)) {
    handleDragOver(event)
    // Sync with global hover state for visual feedback
    setHoveredHex(hex.getId())
  }
}

const handleHexDragLeave = (_event: DragEvent, hex: Hex) => {
  // Only clear if position detection confirms we left this hex
  const currentDetectedHex = hoveredHexId.value
  if (currentDetectedHex !== hex.getId()) {
    setHoveredHex(null)
  }
}

const handleHexDrop = (event: DragEvent, hex: Hex) => {
  // Prevent event from bubbling up to global handlers
  event.stopPropagation()
  event.preventDefault()

  const dropResult = handleDrop(event)

  // Hover state is managed by position-based detection

  if (dropResult) {
    const { character, characterId } = dropResult

    setDropHandled(true) // Prevent duplicate processing

    // Grid-to-grid character moves have sourceHexId from overlay drag handlers
    if (character.sourceHexId !== undefined) {
      const sourceHexId = character.sourceHexId
      const targetHexId = hex.getId()

      // Swap if target is occupied, otherwise move
      if (hasCharacter(gridStore._getGrid(), targetHexId)) {
        characterStore.swapCharacters(sourceHexId, targetHexId)
      } else {
        // Empty target - regular move
        characterStore.moveCharacter(sourceHexId, targetHexId, characterId)
      }
    } else {
      // Character selection placement
      const hexId = hex.getId()
      const tile = gridStore.getTile(hexId)
      const state = tile.state

      // Auto-assign team based on tile state
      let team: Team
      if (state === State.AVAILABLE_ALLY || state === State.OCCUPIED_ALLY) {
        team = Team.ALLY
      } else if (state === State.AVAILABLE_ENEMY || state === State.OCCUPIED_ENEMY) {
        team = Team.ENEMY
      } else {
        return
      }

      // Validate team capacity
      if (!canPlaceCharacterOnTeam(gridStore._getGrid(), characterId, team)) {
        return
      }

      const success = characterStore.placeCharacterOnHex(hexId, characterId, team)
      if (!success) {
        return
      }
    }
  }
}

const getHexDropClass = (hex: Hex) => {
  const hexId = hex.getId()
  const isOccupied = hasCharacter(gridStore._getGrid(), hexId)
  // Use position-based hover detection instead of SVG event-based detection
  const isDragHover = isDragging.value && hoveredHexId.value === hexId

  // Validate drop zone for visual feedback
  let validDropZone = false
  if (isDragHover && draggedCharacter.value) {
    const tile = gridStore.getTile(hexId)
    const state = tile.state

    // Check if tile accepts characters
    if (
      state === State.AVAILABLE_ALLY ||
      state === State.OCCUPIED_ALLY ||
      state === State.AVAILABLE_ENEMY ||
      state === State.OCCUPIED_ENEMY
    ) {
      // Get tile team for validation
      const tileTeam =
        state === State.AVAILABLE_ALLY || state === State.OCCUPIED_ALLY ? Team.ALLY : Team.ENEMY

      // Grid moves: always allow (just repositioning existing characters)
      if (draggedCharacter.value.sourceHexId !== undefined) {
        // This is a character being moved from another hex on the grid
        validDropZone = true
      } else {
        // Character selection: check team capacity
        validDropZone = canPlaceCharacterOnTeam(
          gridStore._getGrid(),
          draggedCharacter.value.id,
          tileTeam,
        )
      }
    }
  }

  return {
    'drop-target': true,
    occupied: isOccupied,
    'drag-hover': isDragHover,
    'invalid-drop': isDragHover && !validDropZone,
    hover: hoveredHex.value === hexId,
  }
}

const isElevated = (hex: Hex) => {
  return hasCharacter(gridStore._getGrid(), hex.getId())
}

// Get stroke style for tiles - includes skill tile color modifiers
const getHexStroke = (hex: Hex) => {
  const hexId = hex.getId()

  // Check for skill tile color modifier if skills are enabled
  if (props.showSkills) {
    const tileColorModifier = skillStore.getTileColorModifier(hexId)
    if (tileColorModifier) {
      return tileColorModifier
    }
  }

  // Default stroke colors
  const isOccupied = hasCharacter(gridStore._getGrid(), hexId)
  return isOccupied ? '#999' : props.hexStrokeColor
}

const getHexStrokeWidth = (hex: Hex) => {
  const hexId = hex.getId()
  const scale = gridStore.getHexScale()

  // Check if this tile has a skill color modifier
  if (props.showSkills) {
    const tileColorModifier = skillStore.getTileColorModifier(hexId)
    if (tileColorModifier) {
      // Use a thicker stroke for skill-highlighted tiles
      return Math.max(3, 4 * scale)
    }
  }

  const isOccupied = hasCharacter(gridStore._getGrid(), hexId)
  return isOccupied ? Math.max(2, 3 * scale) : scaledStrokeWidth.value
}

// Helper to check if a hex has a skill highlight
const hasSkillHighlight = (hex: Hex) => {
  if (!props.showSkills) return false
  const hexId = hex.getId()
  return skillStore.getTileColorModifier(hexId) !== undefined
}

// Separate hexes into rendering layers for proper z-ordering
const regularHexes = computed(() =>
  props.hexes.filter((hex) => !isElevated(hex) && !hasSkillHighlight(hex)),
)
const elevatedHexes = computed(() =>
  props.hexes.filter((hex) => isElevated(hex) && !hasSkillHighlight(hex)),
)
const skillHighlightedHexes = computed(() => props.hexes.filter((hex) => hasSkillHighlight(hex)))

// Hover state is now managed by position-based detection
const handleDragEnded = () => {
  // No longer needed - position-based system handles cleanup
}

// Handle hover events from character layer
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
  document.addEventListener('drag-ended', handleDragEnded)

  // Listen for character hover events
  gridEvents.on('character:mouseenter', handleCharacterHoverEnter)
  gridEvents.on('character:mouseleave', handleCharacterHoverLeave)
})

onUnmounted(() => {
  document.removeEventListener('drag-ended', handleDragEnded)

  // Clean up event listeners
  gridEvents.off('character:mouseenter', handleCharacterHoverEnter)
  gridEvents.off('character:mouseleave', handleCharacterHoverLeave)
})
</script>

<template>
  <svg
    :width="svgDimensions.width"
    :height="svgDimensions.height"
    class="grid-tiles"
    :class="{ 'map-editor-mode': isMapEditorMode }"
    :data-readonly="readonly"
    @mousedown="handleMapEditorMouseDown"
    @mouseup="handleMapEditorMouseUp"
    @mouseleave="handleMapEditorMouseUp"
  >
    <defs>
      <slot name="defs" />
    </defs>
    <g :transform="gridTransform">
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

        <!-- Text layer (render once for all hexes, on top of all tile polygons) -->
        <g v-for="hex in hexes" :key="`text-${hex.getId()}`" class="hex-text">
          <text
            v-if="showHexIds && shouldShowHexId(hex)"
            :x="gridStore.layout.hexToPixel(hex).x"
            :y="gridStore.layout.hexToPixel(hex).y + 6"
            text-anchor="middle"
            :font-size="scaledFontSizes.hexId"
            :fill="textColor"
            font-family="monospace"
            :transform="textTransform(hex)"
          >
            {{ hex.getId() }}
          </text>
          <text
            v-if="shouldShowCoordinates"
            :x="gridStore.layout.hexToPixel(hex).x"
            :y="gridStore.layout.hexToPixel(hex).y + 18"
            text-anchor="middle"
            :font-size="scaledFontSizes.coordinate"
            :fill="coordinateColor"
            font-family="monospace"
            :transform="textTransform(hex)"
          >
            ({{ hex.q }},{{ hex.r }},{{ hex.s }})
          </text>
        </g>

        <!-- Grid tiles are now purely visual, no child components -->

        <!-- 
        Invisible event layer - MUST be rendered last to be topmost layer
        This ensures drag and drop events are captured even when hovering over characters
        All character visual elements have pointer-events: none to allow events to pass through
        -->
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
            @click="!readonly && gridEvents.emit('hex:click', hex)"
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

.grid-tiles.map-editor-mode {
  cursor: crosshair;
}

.grid-tile {
  cursor: pointer;
}

.grid-tiles[data-readonly='true'] .grid-tile {
  cursor: default;
}

.hex-text {
  pointer-events: none; /* Text doesn't block mouse events */
}

.grid-event-layer {
  cursor: pointer;
  pointer-events: all;
  /* Ensure event layer can receive drop events even with HTML overlays above */
}

.grid-tiles[data-readonly='true'] .grid-event-layer {
  cursor: default;
}

/* Ensure event layer polygons can receive all pointer events including drops */
.grid-event-layer polygon {
  pointer-events: all;
  transition:
    fill 0.2s ease,
    stroke 0.2s ease,
    stroke-width 0.2s ease;
}

/* Drag hover states - highest priority with !important */
.grid-event-layer.drop-target.drag-hover:not(.occupied):not(.invalid-drop) polygon {
  fill: rgba(232, 245, 232, 0.3) !important;
  stroke: #36958e !important;
  stroke-width: 3 !important;
  filter: drop-shadow(0 0 8px rgba(76, 175, 80, 0.4));
}

.grid-event-layer.drop-target.drag-hover.occupied:not(.invalid-drop) polygon {
  fill: rgba(255, 232, 232, 0.3) !important;
  stroke: #ff9800 !important;
  stroke-width: 3 !important;
  filter: drop-shadow(0 0 8px rgba(255, 152, 0, 0.4));
}

/* Invalid drop zone styling */
.grid-event-layer.drop-target.drag-hover.invalid-drop polygon {
  fill: rgba(255, 193, 193, 0.3) !important;
  stroke: #c05b4d !important;
  stroke-width: 3 !important;
  filter: drop-shadow(0 0 8px rgba(244, 67, 54, 0.4));
}

/* Regular hover (when not dragging) for tiles and tiles with characters */
.grid-event-layer.drop-target:not(.occupied):not(.drag-hover).hover polygon,
.grid-event-layer.drop-target.occupied:not(.drag-hover).hover polygon {
  fill: rgba(240, 248, 240, 0.3);
  stroke: #36958e;
  stroke-width: 3;
}

/* Visual grid tiles remain clean without interaction styling */
.grid-tile.hover polygon {
  fill-opacity: 0.8;
}
</style>
