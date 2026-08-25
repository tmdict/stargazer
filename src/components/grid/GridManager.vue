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
import type { GridInfoView } from '@/composables/useGridInfoPrefs'
import { useSelectionState } from '@/composables/useSelectionState'
import { teamHasOpenSlot } from '@/lib/characters/character'
import type { Hex } from '@/lib/hex'
import type { CharacterType } from '@/lib/types/character'
import { State } from '@/lib/types/state'
import { useGrids } from '@/stores/grids'
import { useMapEditorStore } from '@/stores/mapEditor'
import { svgPointToScreen } from '@/utils/gridScreenPosition'
import { isTouchClick } from '@/utils/pointer'
import { getTeamFromTileState } from '@/utils/tileStateFormatting'

interface Props {
  // Data props
  characters: readonly CharacterType[]
  // Display toggle props
  info: GridInfoView
  // Debug-tab-only: gates the PathfindingDebug svg (the Arena's Debug tab).
  showDebug?: boolean
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

/* All hex-click semantics live here: map-editor paint, the lifted-hero drop,
 * the sheet-layout tap-target flow, and wide-layout remove-or-pick. A lift
 * exists on any layout (touch gestures lift everywhere), so the drop runs
 * before the layout branch. */
gridEvents.on('hex:click', (hex: Hex, event: MouseEvent) => {
  if (props.readonly) {
    return
  }

  if (props.isMapEditorMode) {
    const hexId = hex.getId()
    mapEditorStore.setHexState(hexId, props.selectedMapEditorState)
    return
  }

  const tile = ctx.grid.getTileById(hex.getId())
  const tileTeam = getTeamFromTileState(tile.state)
  const scale = ctx.hexScale
  // Tap-to-place (mobile sheet / small grids) vs the desktop popup. The page can
  // force the popup: 5 v 5 boards are small but use the on-grid popup, not the
  // shared tap-target state (which would highlight every board's same hex).
  const tap = props.tapMode ?? scale < 1
  if (tileTeam === null) {
    // A non-placement tile cancels a pending lift.
    clearLiftedHex()
    return
  }

  // Drop a lifted hero onto the empty cell through the drop router, so a tap
  // shares every drag gate (page-wide uniqueness, capacity, phantimal team
  // rules). A rejected drop is a silent no-op; either way the lift ends.
  if (liftedHexId.value !== null && tile.characterId === undefined) {
    if (liftedGridId.value !== null) {
      grids.routeLiftDrop(liftedGridId.value, liftedHexId.value, ctx.id, hex.getId())
    }
    clearLiftedHex()
    return
  }

  if (tap) {
    // Target this empty tile so a roster tap fills it. Allowed even when the
    // team is full: a phantimal can still be placed there, and the roster
    // re-checks character capacity before placing a character.
    if (tile.characterId === undefined) {
      clearLiftedHex()
      setTargetHex(hex.getId(), ctx.id)
    }
    return
  }

  // Wide layout: a mouse click on a placed hero's tile removes it (moves use
  // drag); a touch tap does nothing here, since hero taps belong to the
  // character layer's lift flow and a tile-sliver tap must not delete.
  if (tile.characterId !== undefined) {
    if (!isTouchClick(event)) ctx.remove(hex.getId())
    return
  }

  // The picker can only add: skip a tile whose team has nothing left to fill.
  if (!teamHasOpenSlot(ctx.grid, tileTeam, grids.synergy)) return

  // Anchor the popup near the tapped hex. The perspective transform scales Y,
  // but svgPointToScreen (getScreenCTM) already accounts for it.
  const screenPt = svgPointToScreen(ctx.layout.hexToPixel(hex), gridTilesRef.value?.svgEl)
  if (screenPt) {
    modalPosition.value = {
      x: screenPt.x + 30 * scale,
      y: screenPt.y - 50 * scale,
    }
    modalHex.value = hex
    showCharacterModal.value = true
  }
})

const closeCharacterModal = () => {
  showCharacterModal.value = false
  modalHex.value = null
}

// Finds the hex under a screen point by converting the point into SVG space
// and testing it against each hex polygon. No perspective adjustment is needed:
// getScreenCTM already includes the perspective transform.
const findHexUnderMouse = (x: number, y: number): number | null => {
  const svgElement = gridTilesRef.value?.svgEl
  if (!svgElement) return null

  const pt = svgElement.createSVGPoint()
  pt.x = x
  pt.y = y

  const screenCTM = svgElement.getScreenCTM()
  if (!screenCTM) return null
  const svgPt = pt.matrixTransform(screenCTM.inverse())

  for (const hex of ctx.grid.keys()) {
    const corners = ctx.layout.polygonCorners(hex)

    if (isPointInPolygon({ x: svgPt.x, y: svgPt.y }, corners)) {
      return hex.getId()
    }
  }

  return null
}

// Ray-casting point-in-polygon.
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
      continue
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

// Called by DragDropProvider when a drop lands outside a hex tile.
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
      :show-tile-ids="info.tileIds"
      :show-coordinates="info.coordinates"
      :is-map-editor-mode="isMapEditorMode"
      :selected-map-editor-state="selectedMapEditorState"
      :show-perspective="showPerspective"
      :show-skills="showSkills"
      :readonly
    />

    <!-- Artifact layer (behind characters). Team-view hiding and invert-aware
         front/back are handled inside GridArtifacts. -->
    <GridArtifacts
      :ally-artifact-id="ctx.artifacts.ally"
      :enemy-artifact-id="ctx.artifacts.enemy"
      :show-hover="info.hover"
      :show-perspective="showPerspective"
      :scale-y="verticalScaleComp"
      :is-map-editor-mode="isMapEditorMode"
      :readonly
      :tap-mode
    />

    <!-- Character layer (above artifacts) -->
    <GridCharacters
      :characters
      :show-hover="info.hover"
      :show-perspective="showPerspective"
      :scale-y="verticalScaleComp"
      :is-map-editor-mode="isMapEditorMode"
      :readonly
      :tap-mode
    />

    <SkillTargeting
      v-if="showSkills"
      :show-perspective="showPerspective"
      :default-svg-height="defaultSvgHeight"
    />

    <!-- Debug layer (Debug tab only) -->
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

    <!-- Closest-target arrows: last in the stack so they stay readable over
         the pathfinding debug lines when the Debug tab shows both. -->
    <GridArrows
      v-if="info.targeting"
      :show-perspective="showPerspective"
      :default-svg-height="defaultSvgHeight"
    />
  </div>

  <!-- Teleported out of the map container so its transforms don't skew the popup. -->
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
