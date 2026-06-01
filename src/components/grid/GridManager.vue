<script setup lang="ts">
import { inject, onMounted, ref } from 'vue'

import GridArrows from './GridArrows.vue'
import GridArtifacts from './GridArtifacts.vue'
import GridCharacters from './GridCharacters.vue'
import GridTiles from './GridTiles.vue'
import CharacterSelectionPopup from '@/components/CharacterSelectionPopup.vue'
import type DebugPanel from '@/components/debug/DebugPanel.vue'
import PathfindingDebug from '@/components/debug/PathfindingDebug.vue'
import type { DragDropAPI } from '@/components/DragDropProvider.vue'
import SkillTargeting from '@/components/SkillTargeting.vue'
import { provideGridEvents } from '@/composables/useGridEvents'
import { useSelectionState } from '@/composables/useSelectionState'
import { getAvailableTeamSize, getCharacter } from '@/lib/characters/character'
import type { Hex } from '@/lib/hex'
import type { CharacterType } from '@/lib/types/character'
import { State } from '@/lib/types/state'
import { useArtifactStore } from '@/stores/artifact'
import { useCharacterStore } from '@/stores/character'
import { useGridStore } from '@/stores/grid'
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
}

const props = defineProps<Props>()

// Use stores and inject drag/drop API
const gridStore = useGridStore()
const characterStore = useCharacterStore()
const mapEditorStore = useMapEditorStore()
const artifactStore = useArtifactStore()

// Provide grid events to children
const gridEvents = provideGridEvents()

// Inject the drag/drop API from provider
const dragDropAPI = inject<DragDropAPI>('dragDrop')
if (!dragDropAPI) {
  throw new Error('GridManager must be used within a DragDropProvider')
}

const {
  hoveredHexId,
  handleDrop,
  dropHandled,
  setDropHandled,
  registerHexDetector,
  registerDropHandler,
} = dragDropAPI

// Modal state for character selection
const showCharacterModal = ref(false)
const modalHex = ref<Hex | null>(null)
const modalPosition = ref({ x: 0, y: 0 })

// Mobile/tablet places via the pull-up roster sheet (HomeView): a cell tap
// targets the tile, or drops a lifted hero onto it. The desktop popup is used
// only at full scale.
const { liftedHexId, setTargetHex, clearLiftedHex } = useSelectionState()

// Map editor integration - handle hex clicks for painting tiles
// When in map editor mode, clicking a hex changes its state to the selected state
// In normal mode, show character selection modal
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
    const tile = gridStore.getTile(hex.getId())
    const tileTeam = getTeamFromTileState(tile.state)
    const scale = gridStore.getHexScale()
    if (tileTeam === null) {
      // Tapping a non-placement tile cancels a pending lift on mobile.
      if (scale < 1) clearLiftedHex()
      return
    }

    if (scale < 1) {
      const grid = gridStore._getGrid()
      // Drop a lifted hero onto this empty cell. Allowed even when the team is
      // full — a move adds no unit.
      if (liftedHexId.value !== null && tile.characterId === undefined) {
        const characterId = getCharacter(grid, liftedHexId.value)
        if (characterId !== undefined) {
          characterStore.moveCharacter(liftedHexId.value, hex.getId(), characterId)
        }
        clearLiftedHex()
        return
      }
      // Otherwise target this empty tile so a roster tap fills it (needs space).
      if (tile.characterId === undefined && getAvailableTeamSize(grid, tileTeam) > 0) {
        setTargetHex(hex.getId())
      }
      return
    }

    // Desktop popup can only add — skip a tile whose team is already full.
    if (getAvailableTeamSize(gridStore._getGrid(), tileTeam) <= 0) return

    // Desktop: anchor the popup near the tapped hex. The perspective transform
    // scales Y, but svgPointToScreen (getScreenCTM) already accounts for it.
    const screenPt = svgPointToScreen(gridStore.layout.hexToPixel(hex))
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
  const svgElement = document.querySelector<SVGSVGElement>('.grid-tiles')
  if (!svgElement) return null

  // Create SVG point for coordinate conversion
  const pt = svgElement.createSVGPoint()
  pt.x = x
  pt.y = y

  // Convert screen coordinates to SVG coordinates
  const screenCTM = svgElement.getScreenCTM()
  if (!screenCTM) return null
  const svgPt = pt.matrixTransform(screenCTM.inverse())

  // No adjustment needed since perspective offset is removed
  // Check each hex to see if the point is inside it
  for (const hex of gridStore.hexes) {
    const corners = gridStore.layout.polygonCorners(hex)

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
    characterStore.handleCharacterDrop(dropResult, hoveredHexId.value)
  }
}

// Register hex detector and drop handler with DragDropProvider (only if not readonly)
onMounted(() => {
  if (!props.readonly) {
    registerHexDetector(findHexUnderMouse)
    registerDropHandler(handleDetectedHexDrop)
  }
})

// Expose methods for parent components if needed
defineExpose({
  findHexUnderMouse,
})
</script>

<template>
  <div id="map">
    <!-- Grid tiles (base layer) -->
    <GridTiles
      :hexes="gridStore.visibleHexes"
      :layout="gridStore.layout"
      :height="defaultSvgHeight"
      :center-x="gridStore.gridOrigin.x"
      :center-y="gridStore.gridOrigin.y"
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
      :allyArtifactId="artifactStore.allyArtifactId"
      :enemyArtifactId="gridStore.teamView ? null : artifactStore.enemyArtifactId"
      :show-perspective="showPerspective"
      :scaleY="verticalScaleComp"
      :is-map-editor-mode="isMapEditorMode"
      :readonly
    />

    <!-- Character layer (above artifacts) -->
    <GridCharacters
      :characters
      :show-perspective="showPerspective"
      :scaleY="verticalScaleComp"
      :is-map-editor-mode="isMapEditorMode"
      :readonly
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
      :width="600 * gridStore.getHexScale()"
      :height="defaultSvgHeight * gridStore.getHexScale()"
      style="position: absolute; pointer-events: none"
    >
      <g>
        <PathfindingDebug :debugPanelRef="props.debugPanelRef" />
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
#map {
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
}
</style>
