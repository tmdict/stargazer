<script setup lang="ts">
/* One board on the 5 v 5 page: the active-ring chrome around a reused
   GridContainer, plus a per-board clear. Interacting with the board (anywhere)
   makes it the active board, which is what roster clicks and the Maps preset
   target. GridContainer provides the board's context to its descendants. */

import { computed } from 'vue'

import GridContainer from '@/components/grid/GridContainer.vue'
import type { GridContext } from '@/composables/useGridContext'
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

const isActive = computed(() => grids.activeId === context.id)
</script>

<template>
  <div class="grid-board" :class="{ active: isActive }" @pointerdown="grids.setActive(context.id)">
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

    <button type="button" class="board-clear" @click.stop="context.clear()">
      {{ i18n.t('app.clear') }}
    </button>
  </div>
</template>

<style scoped>
.grid-board {
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

/* Image export captures the boards alone: drop the active/hover border + tint so
   they don't bleed into the picture. */
:global(.is-capturing) .grid-board {
  border-color: transparent;
  background: transparent;
  transition: none;
}

.board-clear {
  margin-top: var(--spacing-sm);
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-danger, #c05b4d);
  background: transparent;
  border: 1.5px solid var(--color-danger, #c05b4d);
  border-radius: var(--radius-medium);
  padding: var(--spacing-xs) var(--spacing-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.board-clear:hover {
  background: var(--color-danger, #c05b4d);
  color: #fff;
}
</style>
