<script setup lang="ts">
/* The Teams grid panel: the team title line (document-style name + save
   state), the control bar (mode picker + display toggles, then team save
   actions + share actions), and the horizontally-scrolling row of boards. It's
   the #teams panel of TeamsView's outer TabView; the tab strip and the roster
   live in TeamsView. Boards bind to their own context. */

import GridBoard from '@/components/grid/GridBoard.vue'
import GridControls from '@/components/grid/GridControls.vue'
import BoardsRow from '@/components/teams/BoardsRow.vue'
import TeamModePicker from '@/components/teams/TeamModePicker.vue'
import TeamSaveActions from '@/components/teams/TeamSaveActions.vue'
import { useGridSwap } from '@/composables/useGridSwap'
import type { TeamModeKey } from '@/lib/teams/modes'
import type { CharacterType } from '@/lib/types/character'
import { useGrids } from '@/stores/grids'
import { useI18nStore } from '@/stores/i18n'

defineProps<{
  characters: readonly CharacterType[]
  activeMode: TeamModeKey
  // Title-line and save-action state: source name (null = unsaved), content-dirty
  // flag, and the popover's suggested auto-name.
  sourceName: string | null
  dirty: boolean
  suggestedName: string
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
  newTeam: []
  save: []
  saveAsNew: [name: string]
  exportTeams: []
  importFile: [raw: string]
}>()

const grids = useGrids()
const i18n = useI18nStore()
const { dragging: swapDragging, dragPosition: swapDragPosition } = useGridSwap()
</script>

<template>
  <div class="teams-boards">
    <div class="team-title-row">
      <span class="team-title-wrap">
        <span class="team-title" :class="{ unsaved: sourceName === null }">
          {{ sourceName ?? i18n.t('app.unsaved-team') }}
        </span>
        <span v-if="dirty" class="team-title-status" :title="i18n.t('app.unsaved-changes')">
          <span class="dirty-dot" />
          <span class="status-text">{{ i18n.t('app.unsaved-changes') }}</span>
        </span>
      </span>
    </div>

    <GridControls
      :show-wrap-toggle="canWrap"
      confirm-clear
      v-model:wrap="wrap"
      v-model:show-arrows="showArrows"
      v-model:show-grid-info="showGridInfo"
      v-model:show-perspective="showPerspective"
      v-model:show-skills="showSkills"
      v-model:team-view="grids.teamView"
      @copy-link="emit('copyLink')"
      @copy-image="emit('copyImage')"
      @download="emit('download')"
    >
      <template #toggles-start>
        <TeamModePicker :active-mode @switch-mode="emit('switchMode', $event)" />
      </template>
      <template #actions-start>
        <TeamSaveActions
          :source-name
          :suggested-name
          @new-team="emit('newTeam')"
          @save="emit('save')"
          @save-as-new="emit('saveAsNew', $event)"
          @export-teams="emit('exportTeams')"
          @import-file="emit('importFile', $event)"
        />
      </template>
    </GridControls>

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
/* Document-style title: plain text, deliberately unlike the buttons below it. */
.team-title-row {
  display: flex;
  justify-content: center;
  padding-bottom: var(--spacing-lg);
}

.team-title-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  max-width: min(60vw, 480px);
}

.team-title {
  font-size: 1.3rem;
  font-weight: 700;
  letter-spacing: 0.01em;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.team-title.unsaved {
  color: var(--color-text-secondary);
}

/* Anchored beside the title, out of flow, so appearing/disappearing never
   shifts the centered name. */
.team-title-status {
  position: absolute;
  left: calc(100% + 12px);
  top: 50%;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.dirty-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--color-warning);
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .team-title {
    font-size: 1.05rem;
  }
  /* The dot alone signals unsaved changes: the text would overflow narrow
     viewports from its out-of-flow anchor. */
  .team-title-status .status-text {
    display: none;
  }
}

/* The card's own padding already spaces the controls; the margin GridControls
   carries for the Arena (where it sits below the grid) would double it. */
.teams-boards :deep(.grid-controls) {
  margin-top: 0;
}

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
