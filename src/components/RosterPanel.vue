<script setup lang="ts">
/* The Rosters tab: manage the roster library and edit the active roster's
   heroes in the roster editor. Delete and the editor's Clear share one
   two-step confirm, so only one of them is armed at a time. */

import { computed } from 'vue'

import RosterEditor from './RosterEditor.vue'
import RosterMenu from './RosterMenu.vue'
import RosterTransferActions from './RosterTransferActions.vue'
import ConfirmLabel from '@/components/ui/ConfirmLabel.vue'
import HelpLink from '@/components/ui/HelpLink.vue'
import IconFilePlus from '@/components/ui/IconFilePlus.vue'
import IconTrash from '@/components/ui/IconTrash.vue'
import RenameButton from '@/components/ui/RenameButton.vue'
import { useArmedConfirm } from '@/composables/useArmedConfirm'
import { useInlineRename } from '@/composables/useInlineRename'
import { useRosterFeedback } from '@/composables/useRosterFeedback'
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
const { error } = useToast()
const { report } = useRosterFeedback()

const heroes = computed(() => gameData.characters.filter((c) => !c.placeholder))

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
        <RosterTransferActions />
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
  </div>
</template>

<style scoped>
.roster-panel {
  --dock-scale: 1.2;
  display: flex;
  flex-direction: column;
  gap: var(--picker-row-gap);
}

@media (max-width: 480px) {
  .roster-panel {
    --dock-scale: 1.1;
  }
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
  background: var(--color-bg-raised);
}

.roster-name-input:focus {
  outline: none;
}

@media (max-width: 420px) {
  :is(.roster-rename, .roster-name-input) + .roster-help {
    display: none;
  }
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
