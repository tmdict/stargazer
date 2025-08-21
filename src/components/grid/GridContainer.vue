<script setup lang="ts">
import type { CharacterType } from '../../lib/types/character'
import { State } from '../../lib/types/state'
import type DebugGrid from '../debug/DebugGrid.vue'
import GridManager from './GridManager.vue'

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
  isMapEditorMode?: boolean
  selectedMapEditorState?: State
  // Perspective mode props
  showPerspective: boolean
  // Debug props
  debugGridRef?: InstanceType<typeof DebugGrid> | null
  // Constants
  perspectiveVerticalCompression?: number
  defaultSvgHeight?: number
  // Interaction control
  readonly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isMapEditorMode: false,
  selectedMapEditorState: State.DEFAULT,
  perspectiveVerticalCompression: 0.55,
  defaultSvgHeight: 600,
  readonly: false,
})

// Vertical scale compensation - automatically inverse of grid compression when in perspective mode
const verticalScaleComp = props.showPerspective ? 1 / props.perspectiveVerticalCompression : 1.0
</script>

<template>
  <div class="perspective-container">
    <div
      :style="showPerspective ? { transform: `scaleY(${perspectiveVerticalCompression})` } : {}"
      style="transform-origin: center; transition: transform 0.3s ease-out"
    >
      <GridManager
        :characters
        :character-images
        :artifact-images
        :icons
        :show-arrows
        :show-hex-ids
        :show-debug
        :show-skills
        :is-map-editor-mode
        :selected-map-editor-state
        :showPerspective
        :debugGridRef
        :verticalScaleComp
        :defaultSvgHeight
        :readonly
      />
    </div>
  </div>
</template>

<style scoped>
/* Perspective container - simplified to just hold the grid */
.perspective-container {
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>
