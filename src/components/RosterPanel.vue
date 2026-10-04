<script setup lang="ts">
/* The Rosters tab: manage the roster library and edit the active roster's heroes.
   A portrait tap adds or removes the hero (removal drops its levels, as on a
   board) and its pill steps one level. The dock's select, remove and upgrade
   actions act on every hero the filters show. */

import { computed, ref, watch } from 'vue'

import CharacterFilterStrip from './CharacterFilterStrip.vue'
import CharacterGrid from './CharacterGrid.vue'
import CharacterIcon from './CharacterIcon.vue'
import RosterMenu from './RosterMenu.vue'
import IconDownload from '@/components/ui/IconDownload.vue'
import IconEdit from '@/components/ui/IconEdit.vue'
import IconFilePlus from '@/components/ui/IconFilePlus.vue'
import IconTrash from '@/components/ui/IconTrash.vue'
import IconUpload from '@/components/ui/IconUpload.vue'
import TooltipPopup from '@/components/ui/TooltipPopup.vue'
import UpgradeBulkActions from '@/components/ui/UpgradeBulkActions.vue'
import UpgradeDock from '@/components/ui/UpgradeDock.vue'
import UpgradeDockChip from '@/components/ui/UpgradeDockChip.vue'
import UpgradeDockDivider from '@/components/ui/UpgradeDockDivider.vue'
import UpgradeDockLabel from '@/components/ui/UpgradeDockLabel.vue'
import UpgradeLayerChips from '@/components/ui/UpgradeLayerChips.vue'
import UpgradePill from '@/components/ui/UpgradePill.vue'
import { useArmedConfirm } from '@/composables/useArmedConfirm'
import type { AttrLayerChoice } from '@/composables/useAttrLayerSelection'
import { useCharacterFilters } from '@/composables/useCharacterFilters'
import { useHoverTooltip } from '@/composables/useHoverTooltip'
import { useInlineRename } from '@/composables/useInlineRename'
import { useLibraryTransfer } from '@/composables/useLibraryTransfer'
import { useToast } from '@/composables/useToast'
import {
  ATTR_PARAGON,
  ATTR_REFINEMENT,
  attrDefault,
  attrMax,
  HERO_ATTRS,
  type AttrRecord,
} from '@/lib/characters/attributes'
import { MAX_NAME_LENGTH } from '@/lib/names'
import type { CharacterType } from '@/lib/types/character'
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
const { factionFilter, classFilter, tagFilter, tagPool, filteredCharacters } =
  useCharacterFilters(heroes)

const inspectChips = computed(() => (tagFilter.value ? [tagFilter.value] : undefined))

// A change is applied in memory even when its write fails, so the loss is
// reported in place of any success message.
const report = (message?: string): void => {
  if (!rosters.persisted) error(i18n.t('app.rosters-not-stored'))
  else if (message) success(message)
}

const levelsOf = (character: CharacterType): AttrRecord | undefined =>
  rosters.active?.heroes[character.id]

const editHeroes = (changes: Record<string, AttrRecord | null>): void => {
  const roster = rosters.active
  if (!roster) return
  rosters.setHeroes(roster.id, changes)
  report()
}

const toggle = (character: CharacterType): void =>
  editHeroes({ [character.id]: levelsOf(character) ? null : {} })

const setLevel = (character: CharacterType, attrId: number, level: number): void =>
  editHeroes({ [character.id]: { ...levelsOf(character), [attrId]: level } })

// ---- Dock ----

const shownLevels = computed(() =>
  filteredCharacters.value.flatMap((c) => {
    const levels = levelsOf(c)
    return levels ? [{ id: c.id, levels }] : []
  }),
)
const shownUnowned = computed(() => filteredCharacters.value.filter((c) => !levelsOf(c)))

const selectAll = (): void =>
  editHeroes(Object.fromEntries(shownUnowned.value.map((c) => [c.id, {}])))

// A changed filter, roster or hero set would point an armed Clear at other
// heroes than the ones shown when it was armed.
const { armed, confirm, disarm } = useArmedConfirm()
watch([filteredCharacters, () => rosters.activeId, () => rosters.active?.heroes], disarm)
const removeShown = (): void => {
  if (confirm('remove-shown'))
    editHeroes(Object.fromEntries(shownLevels.value.map(({ id }) => [id, null])))
}

const layer = ref<AttrLayerChoice>(ATTR_PARAGON)
const editLayers = computed(() =>
  layer.value === 'all' ? HERO_ATTRS.map((attr) => attr.id) : [layer.value],
)

const levelOf = (levels: AttrRecord, attrId: number): number =>
  levels[attrId] ?? attrDefault(attrId)

const canRaise = computed(() =>
  shownLevels.value.some(({ levels }) =>
    editLayers.value.some((attrId) => levelOf(levels, attrId) < attrMax(attrId)),
  ),
)

const canReset = computed(() =>
  shownLevels.value.some(({ levels }) =>
    editLayers.value.some((attrId) => levelOf(levels, attrId) > 0),
  ),
)

// Levels clamp on write, so a raise past max stays at max.
const editShown = (next: (level: number, attrId: number) => number): void =>
  editHeroes(
    Object.fromEntries(
      shownLevels.value.map(({ id, levels }) => [
        id,
        {
          ...levels,
          ...Object.fromEntries(
            editLayers.value.map((attrId) => [attrId, next(levelOf(levels, attrId), attrId)]),
          ),
        },
      ]),
    ),
  )

// ---- Library ----

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
  <div v-scroll-chain class="roster-panel" :class="{ scrollable }">
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
          <button
            v-else
            type="button"
            class="rename-btn"
            :title="i18n.t('app.rename')"
            :aria-label="i18n.t('app.rename')"
            @click="startRename(rosters.active.id, rosters.active.name)"
          >
            <IconEdit :size="14" />
          </button>
        </template>
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
          :class="{ armed: armed === rosters.active.id }"
          :title="armed === rosters.active.id ? i18n.t('app.confirm') : i18n.t('app.delete')"
          @click="remove"
        >
          <IconTrash :size="13" class="btn-icon" />
          <span class="btn-text">
            {{ armed === rosters.active.id ? i18n.t('app.confirm') : i18n.t('app.delete') }}
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

    <template v-if="rosters.active">
      <UpgradeDock class="roster-dock">
        <div class="dock-rows">
          <span class="dock-group">
            <UpgradeDockLabel>{{ i18n.t('app.heroes') }}</UpgradeDockLabel>
            <span class="dock-controls">
              <UpgradeDockChip
                text
                :disabled="shownUnowned.length === 0"
                :tip="i18n.t('app.tooltip-select-all-shown')"
                @click="selectAll"
              >
                {{ i18n.t('app.all') }}
              </UpgradeDockChip>
              <UpgradeDockChip
                text
                danger
                :armed="armed === 'remove-shown'"
                :disabled="shownLevels.length === 0"
                :tip="i18n.t('app.tooltip-remove-all-shown')"
                @click="removeShown"
              >
                {{ i18n.t('app.clear') }}
              </UpgradeDockChip>
            </span>
          </span>
          <UpgradeDockDivider />
          <span class="dock-group">
            <UpgradeDockLabel>{{ i18n.t('app.upgrades') }}</UpgradeDockLabel>
            <span class="dock-controls">
              <UpgradeLayerChips :lit="layer" @select="layer = $event" />
              <UpgradeBulkActions
                :can-reset
                :can-raise
                @reset="editShown(() => 0)"
                @raise="editShown((level) => level + 1)"
                @max="editShown((_, attrId) => attrMax(attrId))"
              />
            </span>
          </span>
        </div>
      </UpgradeDock>
      <p class="roster-hint">{{ i18n.t('app.rosters-hint') }}</p>

      <CharacterFilterStrip
        v-model:faction-filter="factionFilter"
        v-model:class-filter="classFilter"
        v-model:tag-filter="tagFilter"
        :characters="heroes"
        :tag-pool
      />

      <CharacterGrid>
        <CharacterIcon
          v-for="character in filteredCharacters"
          :key="character.id"
          :character
          :dimmed="!levelsOf(character)"
          hide-tooltip
          :selected-filter="tagFilter?.tag"
          inspectable
          :inspect-chips
          @character-click="toggle"
        >
          <!-- Reserved, not removed: revealing a pill on select would reflow the
               grid and move the next tap target. -->
          <template #badge>
            <UpgradePill
              :reserved="!levelsOf(character)"
              :paragon="levelsOf(character)?.[ATTR_PARAGON] ?? 0"
              :refinement="levelsOf(character)?.[ATTR_REFINEMENT] ?? 0"
              editable
              compact
              @paragon="setLevel(character, ATTR_PARAGON, $event)"
              @refinement="setLevel(character, ATTR_REFINEMENT, $event)"
            />
          </template>
        </CharacterIcon>
      </CharacterGrid>
    </template>

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
  min-height: var(--panel-min-height);
}

.roster-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--spacing-sm) var(--spacing-lg);
}

.roster-dock {
  container-type: inline-size;
}

.dock-rows {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  width: 100%;
}

.dock-group,
.dock-controls {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
}

/* Too narrow for one line (English needs about 416px): each group takes a row,
   labels in one column so the controls line up, instead of wrapping mid-group. */
@container (max-width: 440px) {
  .dock-rows {
    display: grid;
    grid-template-columns: auto 1fr;
  }
  .dock-group {
    display: contents;
  }
  .dock-divider {
    display: none;
  }
}

/* Clear the panel's scrollbar on desktop, as CharacterSelection's search row
   does. */
@media (min-width: 769px) {
  .roster-bar {
    padding-right: var(--spacing-lg);
  }
  .roster-dock {
    margin-right: var(--spacing-lg);
  }
}

.roster-info,
.roster-actions {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

/* The Teams page title's rename icon. */
.rename-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  border: none;
  background: none;
  border-radius: var(--radius-small);
  color: var(--color-text-secondary);
  opacity: 0.55;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.rename-btn:hover,
.rename-btn:focus-visible {
  opacity: 1;
  color: var(--color-primary);
  background: var(--color-bg-tertiary);
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

.file-input {
  display: none;
}

/* A tap edits the roster, so heroes read as buttons, not drag handles. */
.roster-panel :deep(.character-display) {
  cursor: pointer;
}

/* Half the panel gap, so the hint reads as the control bar's caption. */
.roster-hint {
  margin: calc(var(--spacing-sm) - var(--spacing-lg)) 0 0;
  font-size: 0.8rem;
  color: var(--color-text-secondary);
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

/* The mobile sheet zeroes the card inset, so the panel owns its side padding. */
@media (max-width: 768px) {
  .roster-panel {
    padding: 0 var(--spacing-lg);
  }
  .roster-name-input {
    min-height: 34px;
  }
}

/* Same breakpoint as CharacterSelection: the Arena's height-capped column. */
@media (min-width: 1220px) {
  .roster-panel.scrollable {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
}
</style>
