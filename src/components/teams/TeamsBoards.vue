<script setup lang="ts">
/* The Teams grid panel: the mode row (picker + team actions), the global control
   bar, and the horizontally-scrolling row of boards. It's the #teams panel of
   TeamsView's outer TabView; the tab strip and the roster live in TeamsView.
   Boards bind to their own context. */

import GridBoard from '@/components/grid/GridBoard.vue'
import GridControls from '@/components/grid/GridControls.vue'
import BoardsRow from '@/components/teams/BoardsRow.vue'
import TeamModeControls from '@/components/teams/TeamModeControls.vue'
import { useGridSwap } from '@/composables/useGridSwap'
import type { TeamModeKey } from '@/lib/teams/modes'
import type { CharacterType } from '@/lib/types/character'
import { useGrids } from '@/stores/grids'
import { useI18nStore } from '@/stores/i18n'

defineProps<{
  characters: readonly CharacterType[]
  activeMode: TeamModeKey
  // Mobile: tap a cell to target it for the roster sheet; desktop: the on-grid popup.
  tapMode: boolean
  // Wrap is a desktop-only, 5-board-only layout: its toggle is hidden and the row
  // stays single on the narrow (sheet) view and in smaller modes.
  canWrap: boolean
}>()

// Display flags are owned by TeamsView (the share link serializes them, the URL
// restore sets them); GridControls writes them and every board reads them.
const showArrows = defineModel<boolean>('showArrows', { required: true })
const showGridInfo = defineModel<boolean>('showGridInfo', { required: true })
const showPerspective = defineModel<boolean>('showPerspective', { required: true })
const showSkills = defineModel<boolean>('showSkills', { required: true })
// 3-2 "wrap" boards layout vs one row. Owned by TeamsView and serialized with the
// other display flags, so a share link reproduces it.
const wrap = defineModel<boolean>('wrap', { required: true })

const emit = defineEmits<{
  copyLink: []
  copyImage: []
  download: []
  switchMode: [mode: TeamModeKey]
}>()

const grids = useGrids()
const i18n = useI18nStore()
const { dragging: swapDragging, dragPosition: swapDragPosition } = useGridSwap()
</script>

<template>
  <div class="teams-boards">
    <TeamModeControls :active-mode @switch-mode="emit('switchMode', $event)" />

    <GridControls
      :single-row="true"
      :show-wrap-toggle="canWrap"
      v-model:wrap="wrap"
      v-model:show-arrows="showArrows"
      v-model:show-grid-info="showGridInfo"
      v-model:show-perspective="showPerspective"
      v-model:show-skills="showSkills"
      v-model:team-view="grids.teamView"
      @copy-link="emit('copyLink')"
      @copy-image="emit('copyImage')"
      @download="emit('download')"
    />

    <BoardsRow :wrap :can-wrap>
      <GridBoard
        v-for="ctx in grids.contexts"
        :key="ctx.id"
        :context="ctx"
        :characters="characters"
        :show-arrows="showArrows"
        :show-grid-info="showGridInfo"
        :show-skills="showSkills"
        :show-perspective="showPerspective"
        :tap-mode="tapMode"
      />
    </BoardsRow>

    <!-- Cursor-following label for the desktop swap drag; teleported so the
         scroll container's overflow can't clip it. -->
    <Teleport to="body">
      <div
        v-if="swapDragging"
        class="swap-drag-ghost"
        :style="{ left: `${swapDragPosition.x}px`, top: `${swapDragPosition.y}px` }"
      >
        {{ i18n.t('app.swap') }}
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* Floating label that tracks the cursor during a swap drag (desktop only). */
.swap-drag-ghost {
  position: fixed;
  z-index: 1000;
  transform: translate(-50%, -50%);
  pointer-events: none;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #fff;
  background: var(--color-primary);
  border-radius: var(--radius-medium);
  padding: var(--spacing-xs) var(--spacing-md);
  box-shadow: var(--shadow-soft, 0 2px 8px rgba(0, 0, 0, 0.25));
}
</style>
