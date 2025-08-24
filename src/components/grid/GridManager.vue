<script setup lang="ts">
import { inject, onMounted, ref } from 'vue'

import CharacterSelectionModal from '../CharacterSelectionModal.vue'
import type DebugGrid from '../debug/DebugGrid.vue'
import PathfindingDebug from '../debug/PathfindingDebug.vue'
import type { DragDropAPI } from '../DragDropProvider.vue'
import SkillTargeting from '../SkillTargeting.vue'
import GridArrows from './GridArrows.vue'
import GridArtifacts from './GridArtifacts.vue'
import GridCharacters from './GridCharacters.vue'
import GridTiles from './GridTiles.vue'
import { provideGridEvents } from '../../composables/useGridEvents'
import type { Hex } from '../../lib/hex'
import type { CharacterType } from '../../lib/types/character'
import { State } from '../../lib/types/state'
import { Team } from '../../lib/types/team'
import { useArtifactStore } from '../../stores/artifact'
import { useCharacterStore } from '../../stores/character'
import { useGridStore } from '../../stores/grid'
import { useMapEditorStore } from '../../stores/mapEditor'

interface Props {
  // Data props
  characters: readonly CharacterType[]
  characterImages: Readonly<Record<string, string>>
  artifactImages: Readonly<Record<string, string>>
  icons?: Readonly<Record<string, string>>
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
  debugGridRef?: InstanceType<typeof DebugGrid> | null
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
    // Normal mode - show character selection modal if tile can accept characters
    // Disable modal for mobile and tablet views (scale < 1)
    const scale = gridStore.getHexScale()
    if (scale < 1) {
      // On mobile/tablet, clicking tiles does nothing
      return
    }

    const tile = gridStore.getTile(hex.getId())
    const state = tile.state

    // Check if this is a tile that can accept characters
    if (
      state === State.AVAILABLE_ALLY ||
      state === State.AVAILABLE_ENEMY ||
      state === State.OCCUPIED_ALLY ||
      state === State.OCCUPIED_ENEMY
    ) {
      // Calculate position for modal based on hex position
      // Need to account for perspective transform which is applied to the parent container
      const svgElement = document.querySelector<SVGSVGElement>('.grid-tiles')
      const perspectiveContainer = document.querySelector<HTMLElement>('.perspective-container')

      if (svgElement && perspectiveContainer) {
        const hexPos = gridStore.layout.hexToPixel(hex)

        // Create SVG point for the hex position
        const pt = svgElement.createSVGPoint()
        pt.x = hexPos.x
        pt.y = hexPos.y

        // Transform to screen coordinates using SVG's coordinate system
        const screenCTM = svgElement.getScreenCTM()
        if (screenCTM) {
          const screenPt = pt.matrixTransform(screenCTM)

          // Adjust for perspective scaling if active
          // The perspective transform scales Y, but getScreenCTM already accounts for this
          // We just need to position relative to viewport
          modalPosition.value = {
            x: screenPt.x + 30 * scale, // Scaled offset to the right
            y: screenPt.y - 50 * scale, // Scaled offset above
          }
          modalHex.value = hex
          showCharacterModal.value = true
        }
      }
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
    const xi = vertices[i].x
    const yi = vertices[i].y
    const xj = vertices[j].x
    const yj = vertices[j].y

    if (yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }

  return inside
}

// Handle drops on detected hexes
// This is called by DragDropProvider when a drop occurs outside a hex tile
const handleDetectedHexDrop = (event: DragEvent) => {
  if (hoveredHexId.value !== null && dropHandled.value === false) {
    const hex = gridStore.getHexById(hoveredHexId.value)
    triggerHexDrop(event, hex)
  }
}

// Utility function to trigger drop logic programmatically
const triggerHexDrop = (event: DragEvent, hex: Hex) => {
  // Use the same drop logic as GridTiles.vue
  const dropResult = handleDrop(event)

  if (dropResult) {
    const { character, characterId } = dropResult

    // Mark drop as handled
    setDropHandled(true)

    // Check if this is a character being moved from another hex (drag from grid)
    if (character.sourceHexId !== undefined) {
      const sourceHexId = character.sourceHexId
      const targetHexId = hex.getId()

      // Check if target hex is occupied - if so, swap characters
      if (gridStore.grid.hasCharacter(targetHexId)) {
        characterStore.swapCharacters(sourceHexId, targetHexId)
      } else {
        // Target hex is empty, use regular move
        characterStore.moveCharacter(sourceHexId, targetHexId, characterId)
      }
    } else {
      // This is a new character placement from the character selection
      const hexId = hex.getId()
      const tile = gridStore.getTile(hexId)
      const state = tile.state

      // Determine the team based on tile state
      let team: Team
      if (state === State.AVAILABLE_ALLY || state === State.OCCUPIED_ALLY) {
        team = Team.ALLY
      } else if (state === State.AVAILABLE_ENEMY || state === State.OCCUPIED_ENEMY) {
        team = Team.ENEMY
      } else {
        return
      }

      // Check if the team has space for this character
      if (!gridStore.grid.canPlaceCharacter(characterId, team)) {
        return
      }

      const success = characterStore.placeCharacterOnHex(hexId, characterId, team)
      if (!success) {
        return
      }
    }
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
      :hexes="gridStore.hexes"
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

    <!-- Artifact layer (behind characters) -->
    <GridArtifacts
      :allyArtifactId="artifactStore.allyArtifactId"
      :enemyArtifactId="artifactStore.enemyArtifactId"
      :artifactImages
      :show-perspective="showPerspective"
      :scaleY="verticalScaleComp"
      :readonly
    />

    <!-- Character layer (above artifacts) -->
    <GridCharacters
      :character-images="characterImages"
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
        <PathfindingDebug :debugGridRef="props.debugGridRef" />
      </g>
    </svg>
  </div>

  <!-- Character Selection Modal - Outside of map container to avoid transform issues -->
  <Teleport to="body">
    <CharacterSelectionModal
      v-if="showCharacterModal && modalHex && props.icons"
      :hex="modalHex"
      :characters="props.characters"
      :characterImages="props.characterImages"
      :icons="props.icons"
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
