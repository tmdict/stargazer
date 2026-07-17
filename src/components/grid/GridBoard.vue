<script setup lang="ts">
/* One board on the 5 v 5 page: the active-ring chrome around a reused
   GridContainer, plus a per-board clear. Interacting with the board (anywhere)
   makes it the active board, which is what roster clicks and the Maps preset
   target. GridContainer provides the board's context to its descendants. */

import { computed } from 'vue'

import GridContainer from '@/components/grid/GridContainer.vue'
import TeamPowerPanel from '@/components/grid/TeamPowerPanel.vue'
import IconCopy from '@/components/ui/IconCopy.vue'
import IconDownload from '@/components/ui/IconDownload.vue'
import IconSwap from '@/components/ui/IconSwap.vue'
import IconTrash from '@/components/ui/IconTrash.vue'
import type { GridContext } from '@/composables/useGridContext'
import { useGridExport } from '@/composables/useGridExport'
import { useGridSwap } from '@/composables/useGridSwap'
import type { CharacterType } from '@/lib/types/character'
import { useGrids } from '@/stores/grids'
import { useI18nStore } from '@/stores/i18n'

const { context, showGridInfo, showSkills, showPerspective, tapMode } = defineProps<{
  context: GridContext
  characters: readonly CharacterType[]
  showGridInfo: boolean
  showSkills: boolean
  showPerspective: boolean
  // Mobile: tap a cell to target it for the roster sheet; desktop: the on-grid
  // popup. Driven by the page's breakpoint (the roster is a sheet at the same width).
  tapMode: boolean
}>()

const grids = useGrids()
const i18n = useI18nStore()
const {
  isSwapping,
  sourceId,
  pendingId,
  startFromButton,
  onOverlayDown,
  onOverlayUp,
  clearOverlayPress,
} = useGridSwap()
const { copyToClipboard, downloadAsImage } = useGridExport()

const isActive = computed(() => grids.activeId === context.id)
const isSwapSource = computed(() => sourceId.value === context.id)
const isSwapPending = computed(() => pendingId.value === context.id)

// Export only this board: its .perspective-container holds the grid without the
// active ring (on .grid-board) or these action buttons (siblings). Mirrors the
// single-grid copy/download.
const boardImageOptions = () => ({
  showPerspective,
  target: `[data-grid-board-id="${context.id}"] .perspective-container`,
  appendTarget: `[data-grid-board-id="${context.id}"] .team-power`,
  filePrefix: 'team',
})
const handleCopyImage = () => copyToClipboard(boardImageOptions())
const handleDownloadImage = () => downloadAsImage(boardImageOptions())
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
      :show-grid-info
      :show-debug="false"
      :show-skills
      :show-perspective
      :tap-mode
    />

    <TeamPowerPanel v-if="showGridInfo" :context />

    <div class="board-actions capture-exclude">
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
        class="board-action board-copy"
        :title="i18n.t('app.copy')"
        :aria-label="i18n.t('app.copy')"
        @click.stop="handleCopyImage"
      >
        <IconCopy :size="16" />
      </button>
      <button
        type="button"
        class="board-action board-download"
        :title="i18n.t('app.download')"
        :aria-label="i18n.t('app.download')"
        @click.stop="handleDownloadImage"
      >
        <IconDownload :size="16" />
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

    <!-- A pickable overlay over every board during a swap (source = cancel zone, others
         = targets) that also blocks cell input. Resolving on a tap rather than a press
         lets a swipe scroll the row instead of selecting; on the tap layout the first
         tap previews and a second confirms. -->
    <div
      v-if="isSwapping"
      class="board-swap-overlay"
      :class="{ source: isSwapSource, pending: isSwapPending }"
      @pointerdown.stop="onOverlayDown(context.id, $event)"
      @pointerup="onOverlayUp(context.id, $event)"
      @pointercancel="clearOverlayPress"
    >
      <span v-if="!isSwapSource" class="board-swap-hint">
        {{ isSwapPending ? i18n.t('app.swap-confirm') : i18n.t('app.swap') }}
      </span>
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

/* Icon controls: Swap, then export (Copy, Download), with the destructive Clear
   set apart at the right. Solid-filled circular buttons; the white icon inherits
   the button color via currentColor. */
.board-actions {
  display: flex;
  gap: var(--spacing-md);
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

/* Export actions read as neutral utilities, distinct from the colored swap/clear. */
.board-copy,
.board-download {
  background: var(--color-text-secondary);
}

.board-copy:hover,
.board-download:hover {
  background: var(--color-text-primary);
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

/* Tap layout: the previewed target awaiting its confirming tap, the touch counterpart
   of the desktop drag-over hover. A solid border sets it apart from the dashed targets. */
.board-swap-overlay.pending {
  background: rgba(54, 149, 142, 0.22);
  border-style: solid;
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
