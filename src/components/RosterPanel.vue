<script setup lang="ts">
/* The Rosters tab: manage the roster library and edit the active roster's
   heroes in the roster editor. Delete and the editor's Clear share one
   two-step confirm, so only one of them is armed at a time. */

import { computed } from 'vue'

import RosterEditor from './RosterEditor.vue'
import RosterImportButton from './RosterImportButton.vue'
import RosterMenu from './RosterMenu.vue'
import ConfirmLabel from '@/components/ui/ConfirmLabel.vue'
import HelpLink from '@/components/ui/HelpLink.vue'
import IconDownload from '@/components/ui/IconDownload.vue'
import IconFilePlus from '@/components/ui/IconFilePlus.vue'
import IconTrash from '@/components/ui/IconTrash.vue'
import IconUpload from '@/components/ui/IconUpload.vue'
import RenameButton from '@/components/ui/RenameButton.vue'
import TooltipPopup from '@/components/ui/TooltipPopup.vue'
import { useArmedConfirm } from '@/composables/useArmedConfirm'
import { useHoverTooltip } from '@/composables/useHoverTooltip'
import { useInlineRename } from '@/composables/useInlineRename'
import { useLibraryTransfer } from '@/composables/useLibraryTransfer'
import { useToast } from '@/composables/useToast'
import type { AttrRecord } from '@/lib/characters/attributes'
import { MAX_NAME_LENGTH } from '@/lib/names'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import { useRosters } from '@/stores/rosters'

// Internal flex-fill + own scroll on wide screens (the Arena's height-capped
// column), as CharacterSelection does.
const { scrollable = true } = defineProps<{ scrollable?: boolean }>()

const rosters = useRosters()
const gameData = useGameDataStore()
const i18n = useI18nStore()
const { error, success } = useToast()

const heroes = computed(() => gameData.characters.filter((c) => !c.placeholder))

// A change is applied in memory even when its write fails, so the loss is
// reported in place of any success message.
const report = (message?: string): void => {
  if (!rosters.persisted) error(i18n.t('app.rosters-not-stored'))
  else if (message) success(message)
}

const editHeroes = (changes: Record<string, AttrRecord | null>): void => {
  if (rosters.active) rosters.setHeroes(rosters.active.id, changes)
}

// ---- Library ----

const armedConfirm = useArmedConfirm()
const { armed, confirm } = armedConfirm

const create = (): void => {
  if (!rosters.create()) error(i18n.t('app.rosters-limit'))
  else report()
}

const remove = (): void => {
  const roster = rosters.active
  if (!roster || !confirm(roster.id)) return
  rosters.remove(roster.id)
  report()
}

const {
  editingKey,
  editingName,
  setInput,
  start: startRename,
  commit: commitRename,
  cancel: cancelRename,
} = useInlineRename({
  currentName: (id) => rosters.rosters.find((r) => r.id === id)?.name,
  rename: (id, name) => {
    rosters.rename(id, name)
    report()
  },
})

// Import merges into the library and never replaces it.
const { fileInput, download, handleFileChosen } = useLibraryTransfer({
  filePrefix: 'stargazer-rosters',
  importFile: rosters.importRosters,
  report,
  messages: {
    invalid: 'app.rosters-import-invalid',
    success: 'app.rosters-import-success',
    successConflicts: 'app.rosters-import-success-conflicts',
  },
})

const {
  anchor: tipEl,
  payload: tipKey,
  onMouseEnter: showTip,
  onMouseLeave: hideTip,
  onTouchStart: tipTouchStart,
} = useHoverTooltip<string>()
</script>

<template>
  <div v-scroll-chain class="roster-panel panel-min-height" :class="{ 'panel-fill': scrollable }">
    <div class="roster-bar">
      <span class="roster-info">
        <RosterMenu />
        <template v-if="rosters.active">
          <input
            v-if="editingKey === rosters.active.id"
            :ref="setInput"
            v-model="editingName"
            class="roster-name-input"
            :maxlength="MAX_NAME_LENGTH"
            :aria-label="i18n.t('app.rename')"
            @keydown.enter="commitRename"
            @keydown.esc="cancelRename"
            @blur="commitRename"
          />
          <RenameButton
            v-else
            class="roster-rename"
            @click="startRename(rosters.active.id, rosters.active.name)"
          />
        </template>
        <HelpLink class="roster-help" section="rosters" />
      </span>
      <!-- The Teams control bar's colors and order: New (danger) first, the
           library actions, the destructive Delete last. -->
      <span class="roster-actions">
        <button
          type="button"
          class="control-btn compact danger"
          :title="i18n.t('app.new')"
          @click="create"
        >
          <IconFilePlus :size="13" class="btn-icon" />
          <span class="btn-text">{{ i18n.t('app.new') }}</span>
        </button>
        <RosterImportButton
          @click="hideTip"
          @mouseenter="showTip($event, 'app.tooltip-roster-import')"
          @touchstart.passive="tipTouchStart"
          @mouseleave="hideTip"
        />
        <button
          type="button"
          class="control-btn compact"
          :aria-label="i18n.t('app.import')"
          @click="fileInput?.click()"
          @mouseenter="showTip($event, 'app.tooltip-rosters-import')"
          @touchstart.passive="tipTouchStart"
          @mouseleave="hideTip"
        >
          <IconUpload :size="13" class="btn-icon" />
          <span class="btn-text">{{ i18n.t('app.import') }}</span>
        </button>
        <button
          v-if="rosters.count > 0"
          type="button"
          class="control-btn compact"
          :aria-label="i18n.t('app.export')"
          @click="download(rosters.exportRosters())"
          @mouseenter="showTip($event, 'app.tooltip-rosters-export')"
          @touchstart.passive="tipTouchStart"
          @mouseleave="hideTip"
        >
          <IconDownload :size="13" class="btn-icon" />
          <span class="btn-text">{{ i18n.t('app.export') }}</span>
        </button>
        <button
          v-if="rosters.active"
          type="button"
          class="control-btn compact danger"
          :class="{ 'confirm-armed': armed === rosters.active.id }"
          :title="armed === rosters.active.id ? i18n.t('app.confirm') : i18n.t('app.delete')"
          @click="remove"
        >
          <IconTrash :size="13" class="btn-icon" />
          <span class="btn-text">
            <ConfirmLabel :armed="armed === rosters.active.id" :label="i18n.t('app.delete')" />
          </span>
        </button>
        <input
          ref="fileInput"
          type="file"
          accept="application/json,.json"
          class="file-input"
          @change="handleFileChosen"
        />
      </span>
    </div>

    <RosterEditor
      v-if="rosters.active"
      :heroes
      :levels="rosters.active.heroes"
      :source-key="rosters.activeId"
      :armed-confirm
      @edit="editHeroes"
      @settle="report()"
    />

    <p v-else class="empty-state">
      {{ rosters.count === 0 ? i18n.t('app.rosters-empty') : i18n.t('app.rosters-pick') }}
    </p>

    <Teleport to="body">
      <TooltipPopup v-if="tipKey && tipEl" :target-element="tipEl" variant="detailed">
        <template #content>{{ i18n.t(tipKey) }}</template>
      </TooltipPopup>
    </Teleport>
  </div>
</template>

<style scoped>
.roster-panel {
  display: flex;
  flex-direction: column;
  gap: var(--picker-row-gap);
}

.roster-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--spacing-sm) var(--spacing-lg);
}

/* Clear of the panel's own scrollbar. */
@media (min-width: 769px) {
  .roster-bar {
    padding-right: var(--picker-scrollbar-inset);
  }
  .roster-panel :deep(.roster-dock) {
    margin-right: var(--picker-scrollbar-inset);
  }
}

.roster-info,
.roster-actions {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.roster-name-input {
  min-width: 0;
  min-height: 28px;
  font: inherit;
  font-weight: 700;
  font-size: max(0.85rem, var(--field-min-font-size));
  color: var(--color-text-primary);
  border: 2px solid var(--color-primary);
  border-radius: var(--radius-medium);
  padding: 2px 8px;
  background: var(--color-bg-white);
}

.roster-name-input:focus {
  outline: none;
}

@media (max-width: 420px) {
  :is(.roster-rename, .roster-name-input) + .roster-help {
    display: none;
  }
}

.file-input {
  display: none;
}

.empty-state {
  border: 2px dashed var(--color-border-primary);
  border-radius: var(--radius-large);
  padding: var(--spacing-xl);
  text-align: center;
  color: var(--color-text-secondary);
  font-size: 0.9rem;
  margin: 0;
}

@media (max-width: 768px) {
  .roster-panel {
    padding: 0 var(--panel-inset);
  }
  .roster-name-input {
    min-height: 34px;
  }
}
</style>
