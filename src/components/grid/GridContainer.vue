<script setup lang="ts">
import { computed } from 'vue'

import GridManager from './GridManager.vue'
import type DebugPanel from '@/components/debug/DebugPanel.vue'
import { provideGridContext, type GridContext } from '@/composables/useGridContext'
import type { CharacterType } from '@/lib/types/character'
import { State } from '@/lib/types/state'

interface Props {
  // The board this grid renders; provided to all descendants.
  context: GridContext
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
  debugPanelRef?: InstanceType<typeof DebugPanel> | null
  // Constants
  perspectiveVerticalCompression?: number
  defaultSvgHeight?: number
  // Interaction control
  readonly?: boolean
  // Force tap-to-place (true) or the desktop popup (false); omit to derive from
  // grid scale (small grid = tap). 5 v 5 forces the popup on its small boards.
  tapMode?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isMapEditorMode: false,
  selectedMapEditorState: State.DEFAULT,
  perspectiveVerticalCompression: 0.55,
  defaultSvgHeight: 600,
  readonly: false,
  // Tri-state: keep an omitted tapMode as undefined (not the Boolean-prop default
  // of false) so GridManager's `tapMode ?? scale < 1` falls back to grid scale on
  // the Arena. Without this the Arena mobile cell tap shows the popup, not the sheet.
  tapMode: undefined,
})

// `provide` snapshots its argument, but on the Arena this is bound to the *active*
// board, whose instance is swapped when boards are rebuilt (navigating Arena <->
// 5 v 5 runs setGridCount). Forward through a stable proxy so descendants always
// read the live context, never a disposed one. (On 5 v 5 each board's context is
// fixed, so this is transparent.)
const liveContext = new Proxy({} as GridContext, {
  get: (_target, key) => Reflect.get(props.context, key),
  has: (_target, key) => Reflect.has(props.context, key),
})
provideGridContext(liveContext)

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
// overlays (positioned in literal pixels from the board's layout) stay at full size,
// producing a hex/character offset mismatch.
const fullGridSize = computed(() => {
  const scale = props.context.hexScale
  return {
    width: props.defaultSvgHeight * scale,
    height: props.defaultSvgHeight * scale,
  }
})

const clipStyle = computed(() => {
  if (!props.context.teamView) return {}
  const b = props.context.viewBoxBounds
  return {
    width: `${b.width}px`,
    height: `${b.height}px`,
    overflow: 'hidden',
    position: 'relative',
  } as const
})

const shiftStyle = computed(() => {
  if (!props.context.teamView) return {}
  const b = props.context.viewBoxBounds
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
            :show-perspective
            :debug-panel-ref
            :vertical-scale-comp
            :default-svg-height
            :readonly
            :tap-mode
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
