<script setup lang="ts">
/* The Teams grid panel: the team title line (document-style name with inline
   source-team rename, plus save state), the control bar (mode picker + display
   toggles, then team save actions + share actions), and the
   horizontally-scrolling row of boards. It's
   the #teams panel of TeamsView's outer TabView; the tab strip and the roster
   live in TeamsView. Boards bind to their own context. */

import GridBoard from '@/components/grid/GridBoard.vue'
import GridControls from '@/components/grid/GridControls.vue'
import BoardsRow from '@/components/teams/BoardsRow.vue'
import TeamModePicker from '@/components/teams/TeamModePicker.vue'
import TeamSaveActions from '@/components/teams/TeamSaveActions.vue'
import IconEdit from '@/components/ui/IconEdit.vue'
import TooltipPopup from '@/components/ui/TooltipPopup.vue'
import { useGridSwap } from '@/composables/useGridSwap'
import { useInfoTip } from '@/composables/useInfoTip'
import { useInlineRename } from '@/composables/useInlineRename'
import { MAX_TEAM_NAME_LENGTH, type TeamModeKey } from '@/lib/teams/modes'
import type { CharacterType } from '@/lib/types/character'
import { useGrids } from '@/stores/grids'
import { useI18nStore } from '@/stores/i18n'

const { sourceName } = defineProps<{
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
  rename: [name: string]
  exportTeams: []
  importFile: [raw: string]
}>()

const grids = useGrids()
const i18n = useI18nStore()
const { dragging: swapDragging, dragPosition: swapDragPosition } = useGridSwap()

// The title is a single rename target, so the composable's per-card key is a
// constant. Only a saved source has a name to edit.
const {
  editingKey: renaming,
  editingName: renameValue,
  setInput: setRenameInput,
  start,
  commit: commitRename,
  cancel: cancelRename,
} = useInlineRename({
  currentName: () => sourceName,
  rename: (_key, name) => emit('rename', name),
})

const startRename = (): void => {
  if (sourceName !== null) void start('source', sourceName)
}

// The status text beside the dirty dot is hidden on mobile, so the dot needs
// a tap path to its explanation.
const {
  anchor: unsavedTipAnchor,
  hoverOpen: unsavedTipOpen,
  hoverClose: unsavedTipClose,
  toggle: unsavedTipToggle,
  onTouchStart: unsavedTipTouchStart,
} = useInfoTip()
</script>

<template>
  <div class="teams-boards">
    <div class="team-title-row">
      <span class="team-title-wrap">
        <input
          v-if="renaming !== null"
          :ref="setRenameInput"
          v-model="renameValue"
          class="team-title-input"
          type="text"
          :maxlength="MAX_TEAM_NAME_LENGTH"
          spellcheck="false"
          :aria-label="i18n.t('app.team-name')"
          @keydown.enter.prevent="commitRename"
          @keydown.esc="cancelRename"
          @blur="commitRename"
        />
        <template v-else>
          <span class="team-title" :class="{ unsaved: sourceName === null }">
            {{ sourceName ?? i18n.t('app.unsaved-team') }}
          </span>
          <button
            v-if="sourceName !== null"
            type="button"
            class="title-rename-btn"
            :title="i18n.t('app.rename')"
            :aria-label="i18n.t('app.rename')"
            @click="startRename"
          >
            <IconEdit :size="14" />
          </button>
        </template>
        <span
          v-if="dirty"
          class="team-title-status"
          @mouseenter="unsavedTipOpen"
          @mouseleave="unsavedTipClose"
          @click="unsavedTipToggle"
          @touchstart.passive="unsavedTipTouchStart"
        >
          <span class="dirty-dot" />
          <span class="status-text">{{ i18n.t('app.unsaved-changes') }}</span>
        </span>
      </span>
    </div>

    <GridControls
      :show-wrap-toggle="canWrap"
      confirm-clear
      v-model:wrap="wrap"
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
          :has-source="sourceName !== null"
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

    <Teleport to="body">
      <TooltipPopup
        v-if="unsavedTipAnchor"
        :target-element="unsavedTipAnchor"
        variant="detailed"
        max-width="260px"
      >
        <template #content>{{ i18n.t('app.unsaved-changes') }}</template>
      </TooltipPopup>
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

.title-rename-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  margin-left: var(--spacing-xs);
  flex-shrink: 0;
  border: none;
  background: none;
  border-radius: var(--radius-small);
  color: var(--color-text-secondary);
  opacity: 0.55;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.title-rename-btn:hover,
.title-rename-btn:focus-visible {
  opacity: 1;
  color: var(--color-primary);
  background: var(--color-bg-tertiary);
}

/* Matches the title's type so entering/leaving edit mode doesn't shift the row. */
.team-title-input {
  font: inherit;
  font-size: 1.3rem;
  font-weight: 700;
  letter-spacing: 0.01em;
  color: var(--color-text-primary);
  width: min(60vw, 320px);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-small);
  padding: 0 4px;
  background: var(--color-bg-white);
}

.team-title-input:focus {
  outline: none;
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
  .team-title,
  .team-title-input {
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
