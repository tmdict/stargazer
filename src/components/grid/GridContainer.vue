<script setup lang="ts">
import { computed } from 'vue'

import GridManager from './GridManager.vue'
import type DebugPanel from '@/components/debug/DebugPanel.vue'
import { provideGridContext, type GridContext } from '@/composables/useGridContext'
import type { GridInfoView } from '@/composables/useGridInfoPrefs'
import type { CharacterType } from '@/lib/types/character'
import { State } from '@/lib/types/state'

interface Props {
  // The board this grid renders; provided to all descendants.
  context: GridContext
  // Data props
  characters: readonly CharacterType[]
  // Display toggle props
  info: GridInfoView
  // Debug-tab-only: gates the PathfindingDebug svg (the Arena's Debug tab).
  showDebug?: boolean
  showSkills: boolean
  // Map editor props
  isMapEditorMode?: boolean
  selectedMapEditorState?: State
  // Debug props
  debugPanelRef?: InstanceType<typeof DebugPanel> | null
  // Constants
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

// The squash is a transform, which leaves the box at the board's flat height with
// the squashed board floating in empty space. In perspective the box takes the
// squashed height of the band the board draws in (drawnBounds), and the board
// moves up so that band fills it; team view's clip already starts at its top.
// The box always has an explicit height, so switching views eases it along with
// the board's squash and what sits below moves with the board.
const squash = computed(() => {
  if (!props.context.perspective) {
    return { box: { height: `${props.context.viewBoxBounds.height}px` }, board: {} }
  }
  const c = props.context.layout.squash
  const band = props.context.drawnBounds
  const top = props.context.teamView ? 0 : band.y
  return {
    box: { height: `${band.height * c}px` },
    board: { transform: `translateY(${-top * c}px) scaleY(${c})` },
  }
})

// When team view is on, the team-view-clip wrapper sits inside the perspective wrapper:
// it crops the grid to only the ally region in unscaled SVG coordinates, while the outer
// scaleY transform continues to apply to the cropped result.
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
  <div class="perspective-container" :style="squash.box">
    <div
      :style="squash.board"
      style="transform-origin: top; transition: transform var(--transition-perspective)"
    >
      <div :style="clipStyle">
        <div :style="shiftStyle">
          <GridManager
            :characters
            :info
            :show-debug
            :show-skills
            :is-map-editor-mode
            :selected-map-editor-state
            :debug-panel-ref
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
.perspective-container {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  transition: height var(--transition-perspective);
}
</style>
