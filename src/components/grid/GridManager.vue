<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

import GridArrows from './GridArrows.vue'
import GridArtifacts from './GridArtifacts.vue'
import GridCharacters from './GridCharacters.vue'
import GridTiles from './GridTiles.vue'
import CharacterSelectionPopup from '@/components/CharacterSelectionPopup.vue'
import type DebugPanel from '@/components/debug/DebugPanel.vue'
import PathfindingDebug from '@/components/debug/PathfindingDebug.vue'
import SkillTargeting from '@/components/SkillTargeting.vue'
import { useDragDrop, useDragDropRegistration } from '@/composables/useDragDrop'
import { useGridContext } from '@/composables/useGridContext'
import { provideGridEvents } from '@/composables/useGridEvents'
import { useSelectionState } from '@/composables/useSelectionState'
import { getAvailableTeamSize, getCharacter } from '@/lib/characters/character'
import type { Hex } from '@/lib/hex'
import type { CharacterType } from '@/lib/types/character'
import { State } from '@/lib/types/state'
import { useGrids } from '@/stores/grids'
import { useMapEditorStore } from '@/stores/mapEditor'
import { svgPointToScreen } from '@/utils/gridScreenPosition'
import { getTeamFromTileState } from '@/utils/tileStateFormatting'

interface Props {
  // Data props
  characters: readonly CharacterType[]
  // Display toggle props
  showArrows: boolean
  showHexIds: boolean
  showDebug: boolean
  showSkills: boolean
  // Map editor props
  isMapEditorMode: boolean
  selectedMapEditorState: State
  // Perspective mode props
  showPerspective: boolean
  verticalScaleComp: number
  defaultSvgHeight: number
  // Debug props
  debugPanelRef?: InstanceType<typeof DebugPanel> | null
  // Interaction control
  readonly?: boolean
  // Force tap-to-place vs the desktop popup; omit to derive from grid scale.
  tapMode?: boolean
}

const props = defineProps<Props>()

const ctx = useGridContext()
const grids = useGrids()
const mapEditorStore = useMapEditorStore()

const gridEvents = provideGridEvents()

const { hoveredHexId, handleDrop, dropHandled, setDropHandled } = useDragDrop()
const { registerHexDetector, unregisterHexDetector, registerDropHandler, unregisterDropHandler } =
  useDragDropRegistration()

// GridTiles exposes its root SVG for screen→SVG coordinate conversion
const gridTilesRef = ref<InstanceType<typeof GridTiles> | null>(null)

const showCharacterModal = ref(false)
const modalHex = ref<Hex | null>(null)
const modalPosition = ref({ x: 0, y: 0 })

// Mobile/tablet places via the pull-up roster sheet: a cell tap targets the tile,
// or drops a lifted hero onto it. The desktop popup is used only at full scale.
const { liftedHexId, liftedGridId, setTargetHex, clearLiftedHex } = useSelectionState()

// Map editor integration - handle hex clicks for painting tiles
// All hex-click semantics live here: map-editor paint, the mobile tap flow
// (lift/drop/target), and desktop remove-or-pick.
gridEvents.on('hex:click', (hex: Hex) => {
  // Skip all interactions if readonly
  if (props.readonly) {
    return
  }

  if (props.isMapEditorMode) {
    const hexId = hex.getId()
    mapEditorStore.setHexState(hexId, props.selectedMapEditorState)
  } else {
    // Normal mode — open the character picker for a tile that can take a unit.
    const tile = ctx.grid.getTileById(hex.getId())
    const tileTeam = getTeamFromTileState(tile.state)
    const scale = ctx.hexScale
    // Tap-to-place (mobile sheet / small grids) vs the desktop popup. The page can
    // force the popup: 5 v 5 boards are small but use the on-grid popup, not the
    // shared tap-target state (which would highlight every board's same hex).
    const tap = props.tapMode ?? scale < 1
    if (tileTeam === null) {
      // Tapping a non-placement tile cancels a pending lift on mobile.
      if (tap) clearLiftedHex()
      return
    }

    if (tap) {
      const grid = ctx.grid
      // Drop a hero lifted from THIS board onto the empty cell (cross-board moves
      // go through drag, so a stale lift from another board is dropped below).
      // Allowed even when the team is full — a move adds no unit.
      if (
        liftedHexId.value !== null &&
        liftedGridId.value === ctx.id &&
        tile.characterId === undefined
      ) {
        const characterId = getCharacter(grid, liftedHexId.value)
        if (characterId !== undefined) {
          ctx.move(liftedHexId.value, hex.getId(), characterId)
        }
        clearLiftedHex()
        return
      }
      // Otherwise target this empty tile so a roster tap fills it (dropping any
      // stale lift from another board). Allowed even when the team is full — a
      // phantimal can still be placed there, and the roster re-checks character
      // capacity before placing a character.
      if (tile.characterId === undefined) {
        clearLiftedHex()
        setTargetHex(hex.getId(), ctx.id)
      }
      return
    }

    // Desktop: clicking a placed hero's tile removes it — moves use drag, and
    // the picker below can only add.
    if (tile.characterId !== undefined) {
      ctx.remove(hex.getId())
      return
    }

    // Desktop popup can only add — skip a tile whose team is already full.
    if (getAvailableTeamSize(ctx.grid, tileTeam) <= 0) return

    // Desktop: anchor the popup near the tapped hex. The perspective transform
    // scales Y, but svgPointToScreen (getScreenCTM) already accounts for it.
    const screenPt = svgPointToScreen(ctx.layout.hexToPixel(hex), gridTilesRef.value?.svgEl)
    if (screenPt) {
      modalPosition.value = {
        x: screenPt.x + 30 * scale,
        y: screenPt.y - 50 * scale,
      }
      modalHex.value = hex
      showCharacterModal.value = true
    }
  }
})

const closeCharacterModal = () => {
  showCharacterModal.value = false
  modalHex.value = null
}

/**
 * Utility function to find which hex is under the given screen coordinates
 * Uses point-in-polygon detection to accurately determine hex boundaries
 * Accounts for perspective mode translation offset
 */
const findHexUnderMouse = (x: number, y: number): number | null => {
  // Get the SVG element to convert screen coordinates to SVG coordinates
  const svgElement = gridTilesRef.value?.svgEl
  if (!svgElement) return null

  const pt = svgElement.createSVGPoint()
  pt.x = x
  pt.y = y

  // Convert screen coordinates to SVG coordinates
  const screenCTM = svgElement.getScreenCTM()
  if (!screenCTM) return null
  const svgPt = pt.matrixTransform(screenCTM.inverse())

  // No adjustment needed since perspective offset is removed
  // Check each hex to see if the point is inside it
  for (const hex of ctx.grid.keys()) {
    const corners = ctx.layout.polygonCorners(hex)

    // Point-in-polygon test
    if (isPointInPolygon({ x: svgPt.x, y: svgPt.y }, corners)) {
      return hex.getId()
    }
  }

  return null
}

/**
 * Point-in-polygon algorithm to check if a point is inside a hexagon
 * Uses ray casting algorithm
 */
const isPointInPolygon = (
  point: { x: number; y: number },
  vertices: { x: number; y: number }[],
): boolean => {
  let inside = false
  const n = vertices.length

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const vertexI = vertices[i]
    const vertexJ = vertices[j]
    if (!vertexI || !vertexJ) {
      console.warn('GridManager: Skipping undefined vertices in point-in-polygon check', {
        i,
        j,
        verticesLength: vertices.length,
      })
      continue // Skip if vertices are undefined
    }

    const xi = vertexI.x
    const yi = vertexI.y
    const xj = vertexJ.x
    const yj = vertexJ.y

    if (yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }

  return inside
}

// Handle drops on detected hexes
// This is called by DragDropProvider when a drop occurs outside a hex tile
const handleDetectedHexDrop = (event: DragEvent) => {
  if (hoveredHexId.value === null || dropHandled.value) return
  const dropResult = handleDrop(event)
  if (dropResult) {
    setDropHandled(true)
    grids.routeDrop(dropResult, ctx.id, hoveredHexId.value)
  }
}

// Register this board's hex detector and drop handler with DragDropProvider
// (only if interactive); unregister on unmount so detached boards aren't probed.
onMounted(() => {
  if (!props.readonly) {
    registerHexDetector(ctx.id, findHexUnderMouse)
    registerDropHandler(ctx.id, handleDetectedHexDrop)
  }
})

onUnmounted(() => {
  unregisterHexDetector(ctx.id)
  unregisterDropHandler(ctx.id)
})

// Expose methods for parent components if needed
defineExpose({
  findHexUnderMouse,
})
</script>

<template>
  <div class="grid-map">
    <!-- Grid tiles (base layer) -->
    <GridTiles
      ref="gridTilesRef"
      :hexes="ctx.visibleHexes"
      :layout="ctx.layout"
      :height="defaultSvgHeight"
      :show-hex-ids="showHexIds"
      :show-coordinates="showDebug"
      :is-map-editor-mode="isMapEditorMode"
      :selected-map-editor-state="selectedMapEditorState"
      :show-perspective="showPerspective"
      :show-skills="showSkills"
      :readonly
    />

    <!-- Artifact layer (behind characters); enemy artifact is hidden in team view -->
    <GridArtifacts
      :ally-artifact-id="ctx.artifacts.ally"
      :enemy-artifact-id="ctx.teamView ? null : ctx.artifacts.enemy"
      :show-perspective="showPerspective"
      :scale-y="verticalScaleComp"
      :is-map-editor-mode="isMapEditorMode"
      :readonly
      :tap-mode
    />

    <!-- Character layer (above artifacts) -->
    <GridCharacters
      :characters
      :show-perspective="showPerspective"
      :scale-y="verticalScaleComp"
      :is-map-editor-mode="isMapEditorMode"
      :readonly
      :tap-mode
    />

    <!-- Arrow layer (above characters) -->
    <GridArrows
      :show-arrows="showArrows"
      :show-perspective="showPerspective"
      :default-svg-height="defaultSvgHeight"
    />

    <!-- Skill targeting layer (above arrows) -->
    <SkillTargeting
      v-if="showSkills"
      :show-perspective="showPerspective"
      :default-svg-height="defaultSvgHeight"
    />

    <!-- Debug layer (controlled by Debug View toggle) -->
    <svg
      v-if="showDebug"
      :width="600 * ctx.hexScale"
      :height="defaultSvgHeight * ctx.hexScale"
      style="position: absolute; pointer-events: none"
    >
      <g>
        <PathfindingDebug :debug-panel-ref="props.debugPanelRef" />
      </g>
    </svg>
  </div>

  <!-- Character Selection Modal - Outside of map container to avoid transform issues -->
  <Teleport to="body">
    <CharacterSelectionPopup
      v-if="showCharacterModal && modalHex"
      :hex="modalHex"
      :characters="props.characters"
      :position="modalPosition"
      @close="closeCharacterModal"
    />
  </Teleport>
</template>

<style scoped>
.grid-map {
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  /* Own stacking context so the artifact cell border (z-index: -1) sits beneath the
     tiles but can't fall behind the page/card. */
  isolation: isolate;
}
</style>
