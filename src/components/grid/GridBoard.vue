<script setup lang="ts">
/* One board on the 5 v 5 page: the active-ring chrome around a reused
   GridContainer, plus a per-board clear. Interacting with the board (anywhere)
   makes it the active board, which is what roster clicks and the Maps preset
   target. GridContainer provides the board's context to its descendants. */

import { computed } from 'vue'

import GridContainer from '@/components/grid/GridContainer.vue'
import IconSwap from '@/components/ui/IconSwap.vue'
import IconTrash from '@/components/ui/IconTrash.vue'
import type { GridContext } from '@/composables/useGridContext'
import { useGridSwap } from '@/composables/useGridSwap'
import type { CharacterType } from '@/lib/types/character'
import { useGrids } from '@/stores/grids'
import { useI18nStore } from '@/stores/i18n'

const { context, showArrows, showHexIds, showSkills, showPerspective, tapMode } = defineProps<{
  context: GridContext
  characters: readonly CharacterType[]
  showArrows: boolean
  showHexIds: boolean
  showSkills: boolean
  showPerspective: boolean
  // Mobile: tap a cell to target it for the roster sheet; desktop: the on-grid
  // popup. Driven by the page's breakpoint (the roster is a sheet at the same width).
  tapMode: boolean
}>()

const grids = useGrids()
const i18n = useI18nStore()
const { isSwapping, sourceId, startFromButton, selectTarget } = useGridSwap()

const isActive = computed(() => grids.activeId === context.id)
const isSwapSource = computed(() => sourceId.value === context.id)
</script>

<template>
  <div
    class="grid-board"
    :class="{ active: isActive }"
    :data-grid-board-id="context.id"
    @pointerdown="grids.setActive(context.id)"
  >
    <GridContainer
      :context
      :characters
      :show-arrows
      :show-hex-ids
      :show-debug="false"
      :show-skills
      :show-perspective
      :tap-mode
    />

    <div class="board-actions">
      <button
        type="button"
        class="board-action board-swap"
        :title="i18n.t('app.swap')"
        :aria-label="i18n.t('app.swap')"
        @pointerdown="startFromButton(context.id, $event, !tapMode)"
        @click.stop
      >
        <IconSwap :size="16" />
      </button>
      <button
        type="button"
        class="board-action board-clear"
        :title="i18n.t('app.clear')"
        :aria-label="i18n.t('app.clear')"
        @click.stop="context.clear()"
      >
        <IconTrash :size="16" />
      </button>
    </div>

    <!-- During a swap every board shows a pickable overlay; the source is the
         cancel zone, the others are swap targets. It also blocks cell input while
         a swap is being aimed. -->
    <div
      v-if="isSwapping"
      class="board-swap-overlay"
      :class="{ source: isSwapSource }"
      @pointerdown.stop="selectTarget(context.id)"
    >
      <span v-if="!isSwapSource" class="board-swap-hint">{{ i18n.t('app.swap') }}</span>
    </div>
  </div>
</template>

<style scoped>
.grid-board {
  position: relative;
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--spacing-sm);
  border: 2px solid transparent;
  border-radius: var(--radius-large);
  /* The whole board is clickable to make it the active board. */
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast);
}

/* A single border conveys board state: grey on hover, primary (teal) when active. */
.grid-board.active {
  border-color: var(--color-primary);
}

.grid-board:hover:not(.active) {
  border-color: var(--color-border-light);
  background: var(--color-bg-light-gray);
}

/* Icon controls: Swap sits to the left of Clear. Solid-filled circular buttons;
   the white icon inherits the fill color via currentColor. */
.board-actions {
  display: flex;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-sm);
}

.board-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 999px;
  color: #fff;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.board-swap {
  background: var(--color-primary);
  /* Drag starts here; suppress native text-selection / touch scrolling on press. */
  touch-action: none;
  user-select: none;
}

.board-swap:hover {
  background: var(--color-primary-hover);
}

.board-clear {
  background: var(--color-danger);
}

.board-clear:hover {
  background: var(--color-danger-hover);
}

/* Covers the whole board while a swap is being aimed: targets invite a click,
   the source reads as a cancel zone. */
.board-swap-overlay {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-large);
  border: 2px dashed var(--color-primary);
  background: rgba(54, 149, 142, 0.12);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.board-swap-overlay:hover {
  background: rgba(54, 149, 142, 0.22);
}

.board-swap-overlay.source {
  border-style: solid;
  border-color: var(--color-border-light);
  background: rgba(0, 0, 0, 0.06);
  cursor: default;
}

.board-swap-hint {
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-primary);
  background: var(--color-bg-white);
  border-radius: var(--radius-medium);
  padding: var(--spacing-xs) var(--spacing-md);
  box-shadow: var(--shadow-soft, 0 1px 4px rgba(0, 0, 0, 0.15));
}
</style>
