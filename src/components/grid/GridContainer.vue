<script setup lang="ts">
import { computed } from 'vue'

import GridManager from './GridManager.vue'
import type DebugGrid from '@/components/debug/DebugGrid.vue'
import type { CharacterType } from '@/lib/types/character'
import { State } from '@/lib/types/state'
import { useGridStore } from '@/stores/grid'

interface Props {
  // Data props
  characters: readonly CharacterType[]
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

const gridStore = useGridStore()

// Vertical scale compensation - automatically inverse of grid compression when in perspective mode
const verticalScaleComp = computed(() =>
  props.showPerspective ? 1 / props.perspectiveVerticalCompression : 1.0,
)

// When team view is on, the team-view-clip wrapper sits inside the perspective wrapper:
// it crops the grid to only the ally region in unscaled SVG coordinates, while the outer
// scaleY transform continues to apply to the cropped result. This keeps the existing
// perspective-crop math (image is `bounds.height * (1 - compression) / 2` whitespace top/bottom)
// working without modification.
//
// shiftStyle gets explicit full-grid dimensions (defaultSvgHeight × defaultSvgHeight, scaled
// by the breakpoint factor): otherwise, position:absolute shrink-to-fit interacts with the
// `max-width: 100%` on .grid-tiles and shrinks the SVG to the clip width while character
// overlays (positioned in literal pixels from gridStore.getHexPosition) stay at full size,
// producing a hex/character offset mismatch.
const fullGridSize = computed(() => {
  const scale = gridStore.getHexScale()
  return {
    width: props.defaultSvgHeight * scale,
    height: props.defaultSvgHeight * scale,
  }
})

const clipStyle = computed(() => {
  if (!gridStore.teamView) return {}
  const b = gridStore.viewBoxBounds
  return {
    width: `${b.width}px`,
    height: `${b.height}px`,
    overflow: 'hidden',
    position: 'relative',
  } as const
})

const shiftStyle = computed(() => {
  if (!gridStore.teamView) return {}
  const b = gridStore.viewBoxBounds
  const f = fullGridSize.value
  return {
    position: 'absolute',
    top: `${-b.y}px`,
    left: `${-b.x}px`,
    width: `${f.width}px`,
    height: `${f.height}px`,
  } as const
})
</script>

<template>
  <div class="perspective-container">
    <div
      :style="showPerspective ? { transform: `scaleY(${perspectiveVerticalCompression})` } : {}"
      style="transform-origin: center; transition: transform 0.3s ease-out"
    >
      <div :style="clipStyle">
        <div :style="shiftStyle">
          <GridManager
            :characters
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
