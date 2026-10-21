<script setup lang="ts">
/* The Saved Teams side-panel tab: a bar (count, cap warning, sort, search, and
   Import / Export / Delete all), a filter row (mode, the type chips for board
   counts with named types, one-sided), plus a card grid: thumbnail, mode, type
   and Syn chips, inline-renamable name, relative updated time, and Load /
   Duplicate / Copy / Download / Delete actions. Destructive actions use the
   app's no-modal style: a two-step inline confirm that arms for a few seconds.
   User feedback (toasts) is fired here, not in the store. */

import { computed, ref, watch } from 'vue'

import TeamPreviewModal from '@/components/modals/TeamPreviewModal.vue'
import SavedTeamsSearch from '@/components/teams/SavedTeamsSearch.vue'
import TeamPreview, { estimatedPreviewHeight } from '@/components/teams/TeamPreview.vue'
import ConfirmLabel from '@/components/ui/ConfirmLabel.vue'
import IconCopy from '@/components/ui/IconCopy.vue'
import IconDownload from '@/components/ui/IconDownload.vue'
import IconInfo from '@/components/ui/IconInfo.vue'
import MountOnVisible from '@/components/ui/MountOnVisible.vue'
import RenameButton from '@/components/ui/RenameButton.vue'
import SegmentedPicker from '@/components/ui/SegmentedPicker.vue'
import TooltipPopup from '@/components/ui/TooltipPopup.vue'
import { useArmedConfirm } from '@/composables/useArmedConfirm'
import { useHoverTooltip } from '@/composables/useHoverTooltip'
import { useInfoTip } from '@/composables/useInfoTip'
import { useInlineRename } from '@/composables/useInlineRename'
import { useLibraryTransfer } from '@/composables/useLibraryTransfer'
import { useSavedTeamSearch } from '@/composables/useSavedTeamSearch'
import { useTeamLibraryFeedback } from '@/composables/useTeamLibraryFeedback'
import { useThumbnailExport } from '@/composables/useThumbnailExport'
import { useToast } from '@/composables/useToast'
import { useUpdatedLabel } from '@/composables/useUpdatedLabel'
import { MAX_NAME_LENGTH } from '@/lib/names'
import {
  DEFAULT_VARIANT,
  MAX_SAVED_TEAMS,
  TEAM_MODE_ORDER,
  TEAM_MODES,
  TEAM_VARIANTS,
  variantsForMode,
  type TeamModeKey,
  type TeamVariantChoice,
} from '@/lib/teams/modes'
import { teamHasSynergy, teamTypeLabelKey, teamVariant } from '@/lib/teams/preview'
import { type SavedTeam } from '@/lib/teams/savedTeam'
import { savedTeamSide } from '@/lib/teams/sideLoad'
import { useI18nStore } from '@/stores/i18n'
import { useTeamLibrary } from '@/stores/teamLibrary'
import { readStorage, writeStorage } from '@/utils/storage'

const { loadedTeamId } = defineProps<{
  // The team the live boards were loaded from / last saved to; its card gets
  // the "Loaded" ring (the same provenance the Unsaved-changes indicator uses).
  loadedTeamId: string | null
}>()

const emit = defineEmits<{ load: [team: SavedTeam] }>()

const i18n = useI18nStore()
const library = useTeamLibrary()
const { show, error } = useToast()
const { report } = useTeamLibraryFeedback()

// Device-level sort preference: last-modified first (the default) or by name.
const SORT_STORAGE_KEY = 'stargazer.teams.sort'
type SortKey = 'recent' | 'name'
const SORT_KEYS: SortKey[] = ['recent', 'name']
const sortBy = ref<SortKey>(readStorage(SORT_STORAGE_KEY) === 'name' ? 'name' : 'recent')
watch(sortBy, (value) => writeStorage(SORT_STORAGE_KEY, value))
const sortSegments = computed(() =>
  SORT_KEYS.map((key) => ({
    key,
    label: i18n.t(`app.sort-${key}`),
    selected: sortBy.value === key,
  })),
)

// numeric:true keeps auto-names in counting order ("Team 2" before "Team 10").
const nameCollator = computed(
  () => new Intl.Collator(i18n.currentLocale, { numeric: true, sensitivity: 'base' }),
)

const sorted = computed(() => {
  const teams = [...library.teams]
  return sortBy.value === 'name'
    ? teams.sort((a, b) => nameCollator.value.compare(a.name, b.name) || b.updatedAt - a.updatedAt)
    : teams.sort((a, b) => b.updatedAt - a.updatedAt)
})

type ModeFilter = 'all' | TeamModeKey
// Every mode stays on offer whatever the library holds: a segment that vanished
// with its last team would strand the selection, and an empty mode reaches the
// same "no matches" state a query does.
const MODE_FILTERS: ModeFilter[] = ['all', ...TEAM_MODE_ORDER]
// Unlike the sort preference this stays out of storage: a filter restored on
// load would read as missing teams.
const modeFilter = ref<ModeFilter>('all')
const modeSegments = computed(() =>
  MODE_FILTERS.map((key) => ({
    key,
    label: key === 'all' ? i18n.t('app.all') : i18n.t(TEAM_MODES[key].labelKey),
    selected: modeFilter.value === key,
  })),
)

const modeFiltered = computed(() =>
  modeFilter.value === 'all'
    ? sorted.value
    : sorted.value.filter((team) => team.mode === modeFilter.value),
)

// The type row exists only for a board count with named types; its choices
// come from the registry, so a new type appears here by itself. A type belongs
// to one board count, so any change of the mode filter resets the selection:
// a stale one would show an empty list with nothing lit.
type TypeFilter = 'all' | TeamVariantChoice
const typeFilter = ref<TypeFilter>('all')
const typeFilters = computed((): TypeFilter[] => {
  if (modeFilter.value === 'all') return []
  const variants = variantsForMode(modeFilter.value)
  return variants.length === 0
    ? []
    : ['all', DEFAULT_VARIANT, ...variants.map((variant) => variant.key)]
})
watch(modeFilter, () => {
  typeFilter.value = 'all'
})
const typeFiltered = computed(() =>
  typeFilter.value === 'all'
    ? modeFiltered.value
    : modeFiltered.value.filter((team) => teamVariant(team.data) === typeFilter.value),
)
const typeLabel = (choice: TeamVariantChoice): string =>
  choice === DEFAULT_VARIANT ? i18n.t('app.default') : i18n.t(TEAM_VARIANTS[choice].labelKey)

// Narrows to teams the Load menu can side-load (savedTeamSide: every unit on
// one team). Like the mode filter, deliberately not persisted.
const oneSideOnly = ref(false)
const sideFiltered = computed(() =>
  oneSideOnly.value
    ? typeFiltered.value.filter((team) => savedTeamSide(team.data) !== null)
    : typeFiltered.value,
)

// Matching itself (hero pills, name hit with highlight snippet, hero hit at
// 2+ characters) is the shared useSavedTeamSearch composable, also used by
// the Load menu.
const searchVisible = computed(() => library.count > 1)
const {
  query: searchQuery,
  heroes: searchHeroes,
  suggestions: searchSuggestions,
  results: visibleTeams,
  addHero: addSearchHero,
  removeHero: removeSearchHero,
  clear: clearSearch,
} = useSavedTeamSearch(() => sideFiltered.value)
// The box hides below 2 teams; hiding also resets pills and text (which
// matching reads), so a leftover search can never strand the list on "no
// matches" with no visible way to clear it, and the box can't reappear
// pre-filtered.
watch(searchVisible, (visible) => {
  if (!visible) clearSearch()
})

const nearCap = computed(() => library.count >= MAX_SAVED_TEAMS * 0.8)

const modeChip = (team: SavedTeam): string => i18n.t(TEAM_MODES[team.mode].labelKey)

const updatedLabel = useUpdatedLabel()

// 'all' = the Delete all button; team ids arm the per-card Delete.
const { armed, confirm } = useArmedConfirm()

const handleDelete = (team: SavedTeam): void => {
  if (!confirm(team.id)) return
  library.remove(team.id)
  report(i18n.t('app.team-deleted'))
}

const handleDeleteAll = (): void => {
  if (!confirm('all')) return
  library.removeAll()
  report(i18n.t('app.teams-deleted'))
}

const { copyToClipboard, downloadAsImage } = useThumbnailExport()

// The team outlives the close so the modal's leave transition keeps its content.
const previewedTeam = ref<SavedTeam | null>(null)
const previewOpen = ref(false)

const openPreview = (team: SavedTeam): void => {
  previewedTeam.value = team
  previewOpen.value = true
}

const handleDuplicate = (team: SavedTeam): void => {
  const copy = library.duplicate(team.id)
  if (!copy) {
    error(i18n.t('app.teams-limit', { max: MAX_SAVED_TEAMS }))
    return
  }
  report()
  // Edits made right after duplicating should land on the copy, not on
  // whatever the boards held before.
  emit('load', copy)
}

const {
  editingKey: editingId,
  editingName,
  setInput: setNameInput,
  start,
  commit: commitRename,
  cancel: cancelRename,
} = useInlineRename({
  currentName: (id) => library.get(id)?.name,
  rename: (id, name) => {
    library.rename(id, name)
    report()
  },
})

const startRename = (team: SavedTeam): Promise<void> => start(team.id, team.name)

// A real button, so focus/blur mirror the hover handlers and Enter/Space
// toggle through the native click.
const {
  anchor: storageHintAnchor,
  hoverOpen: storageHintOpen,
  hoverClose: storageHintClose,
  toggle: storageHintToggle,
  onTouchStart: storageHintTouchStart,
} = useInfoTip()

// Import and Export act on the library rather than the boards, which is why
// they belong in this panel rather than the boards' action row. Import merges
// into the library and never replaces it; "replace everything" is Delete all
// followed by Import.
const { fileInput, download, handleFileChosen } = useLibraryTransfer({
  filePrefix: 'stargazer-teams',
  importFile: library.importTeams,
  report,
  messages: {
    invalid: 'app.import-invalid',
    success: 'app.import-success',
    successConflicts: 'app.import-success-conflicts',
  },
})

// A filtered export names its criteria back to the user (button label and
// tooltip before, toast after), so a partial backup can't pass for a full one.
const filterLabels = computed((): string[] => {
  const labels: string[] = []
  if (modeFilter.value !== 'all') labels.push(i18n.t(TEAM_MODES[modeFilter.value].labelKey))
  if (typeFilter.value !== 'all') labels.push(typeLabel(typeFilter.value))
  if (oneSideOnly.value) labels.push(i18n.t('app.one-sided'))
  for (const hero of searchHeroes.value) labels.push(hero.label)
  const query = searchQuery.value.trim()
  if (query) labels.push(`“${query}”`)
  return labels
})
const exportFiltered = computed(() => filterLabels.value.length > 0)
const filterSummary = computed(() =>
  new Intl.ListFormat(i18n.currentLocale, { type: 'conjunction' }).format(filterLabels.value),
)

const handleExport = (): void => {
  const selection = exportFiltered.value
    ? visibleTeams.value.map(({ team }) => team)
    : library.teams
  // The button hides at zero teams, so an empty selection is a filter that
  // matched nothing.
  if (selection.length === 0) {
    error(i18n.t('app.teams-no-matches'))
    return
  }
  download(library.exportTeams(selection))
  if (exportFiltered.value) {
    show(
      i18n.t('app.export-filtered', {
        count: selection.length,
        total: library.count,
        filters: filterSummary.value,
      }),
      'info',
      5000,
    )
  }
}

// Hover-only, unlike the storage hint: these act on tap, so the composable
// suppresses the tooltip on touch.
const {
  anchor: actionTipAnchor,
  payload: actionTip,
  onMouseEnter: showActionTip,
  onMouseLeave: hideActionTip,
  onTouchStart: actionTipTouchStart,
} = useHoverTooltip<'import' | 'export'>()

const actionTipText = computed((): string => {
  if (!actionTip.value) return ''
  return actionTip.value === 'export' && exportFiltered.value
    ? i18n.t('app.tooltip-export-filtered', { filters: filterSummary.value })
    : i18n.t(`app.tooltip-${actionTip.value}`)
})
</script>

<template>
  <div class="saved-teams">
    <div class="library-bar">
      <span class="library-info">
        <span class="library-count" :class="{ warn: nearCap }">
          {{ library.count }} / {{ MAX_SAVED_TEAMS }}
        </span>
        <button
          type="button"
          class="storage-hint"
          :aria-label="i18n.t('app.storage-hint')"
          @mouseenter="storageHintOpen"
          @mouseleave="storageHintClose"
          @focus="storageHintOpen"
          @blur="storageHintClose"
          @click="storageHintToggle"
          @touchstart.passive="storageHintTouchStart"
        >
          <IconInfo :size="15" />
        </button>
        <SegmentedPicker
          v-if="library.count > 1"
          small
          class="sort-picker"
          :segments="sortSegments"
          :aria-label="i18n.t('app.sort')"
          @select="sortBy = $event"
        />
        <SavedTeamsSearch
          v-if="searchVisible"
          v-model="searchQuery"
          class="team-search"
          :heroes="searchHeroes"
          :suggestions="searchSuggestions"
          @add-hero="addSearchHero"
          @remove-hero="removeSearchHero"
          @clear="clearSearch"
        />
      </span>
      <span class="library-actions">
        <!-- Import stays visible at zero teams: restoring a backup into an empty
             library is exactly when it's needed. -->
        <button
          type="button"
          class="library-btn solid-btn"
          @click="fileInput?.click()"
          @mouseenter="showActionTip($event, 'import')"
          @touchstart.passive="actionTipTouchStart"
          @mouseleave="hideActionTip"
        >
          {{ i18n.t('app.import') }}
        </button>
        <button
          v-if="library.count > 0"
          type="button"
          class="library-btn solid-btn"
          @click="handleExport"
          @mouseenter="showActionTip($event, 'export')"
          @touchstart.passive="actionTipTouchStart"
          @mouseleave="hideActionTip"
        >
          {{
            exportFiltered
              ? i18n.t('app.export-count', { count: visibleTeams.length, total: library.count })
              : i18n.t('app.export')
          }}
        </button>
        <button
          v-if="library.count > 0"
          type="button"
          class="library-btn solid-btn delete-all-btn"
          :class="{ armed: armed === 'all' }"
          @click="handleDeleteAll"
        >
          <ConfirmLabel :armed="armed === 'all'" :label="i18n.t('app.delete-all')" />
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

    <!-- The filters, in pipeline order (mode, type, one-sided), on their own
         row so the bar keeps the library-wide controls. -->
    <div class="filter-row">
      <SegmentedPicker
        small
        :segments="modeSegments"
        :aria-label="i18n.t('app.teams')"
        @select="modeFilter = $event"
      />
      <!-- Wrapping chips rather than a pill segment: a board count may grow
           many types, and the row must stay readable in the phone-width sheet. -->
      <div
        v-if="typeFilters.length > 0"
        class="type-group"
        role="group"
        :aria-label="i18n.t('app.type')"
      >
        <span class="type-label">{{ i18n.t('app.type') }}</span>
        <button
          v-for="key in typeFilters"
          :key
          type="button"
          :aria-pressed="typeFilter === key"
          class="type-chip"
          :class="{ active: typeFilter === key }"
          @click="typeFilter = key"
        >
          {{ key === 'all' ? i18n.t('app.all') : typeLabel(key) }}
        </button>
      </div>
      <SegmentedPicker
        small
        :segments="[{ key: 'one-sided', label: i18n.t('app.one-sided'), selected: oneSideOnly }]"
        :aria-label="i18n.t('app.one-sided')"
        @select="oneSideOnly = !oneSideOnly"
      />
    </div>

    <p v-if="library.count === 0" class="empty-state">
      {{ i18n.t('app.saved-teams-empty') }}
    </p>

    <p v-else-if="visibleTeams.length === 0" class="empty-state">
      {{ i18n.t('app.teams-no-matches') }}
    </p>

    <div v-else class="team-grid">
      <div
        v-for="{ team, name, highlightHeroes } in visibleTeams"
        :key="team.id"
        class="team-card"
        :class="{ loaded: team.id === loadedTeamId }"
      >
        <button
          type="button"
          class="preview-btn"
          :title="i18n.t('app.preview')"
          :aria-label="i18n.t('app.preview')"
          @click="openPreview(team)"
        >
          <MountOnVisible :estimated-height="estimatedPreviewHeight(team.mode)">
            <TeamPreview :team :highlight-heroes="highlightHeroes" />
          </MountOnVisible>
        </button>

        <div class="card-title-row">
          <input
            v-if="editingId === team.id"
            :ref="setNameInput"
            v-model="editingName"
            class="team-name-input"
            type="text"
            :maxlength="MAX_NAME_LENGTH"
            spellcheck="false"
            @keydown.enter.prevent="commitRename"
            @keydown.esc="cancelRename"
            @blur="commitRename"
          />
          <template v-else>
            <button type="button" class="team-name" @click="startRename(team)">
              {{ name.pre }}<mark v-if="name.match">{{ name.match }}</mark
              >{{ name.post }}
              <span v-if="team.id === loadedTeamId" class="visually-hidden">
                ({{ i18n.t('app.loaded') }})
              </span>
            </button>
            <RenameButton small @click="startRename(team)" />
          </template>
        </div>

        <div class="card-meta-row">
          <span class="mode-chip">{{ modeChip(team) }}</span>
          <span v-if="teamTypeLabelKey(team.data)" class="mode-chip">
            {{ i18n.t(teamTypeLabelKey(team.data)!) }}
          </span>
          <span v-if="teamHasSynergy(team.data)" class="mode-chip">
            {{ i18n.t('app.syn') }}
          </span>
          <span class="card-meta">{{ updatedLabel(team.updatedAt) }}</span>
        </div>

        <div class="card-actions">
          <button type="button" class="card-btn primary" @click="emit('load', team)">
            {{ i18n.t('app.load') }}
          </button>
          <button type="button" class="card-btn" @click="handleDuplicate(team)">
            {{ i18n.t('app.duplicate') }}
          </button>
          <button
            type="button"
            class="card-btn icon"
            :title="i18n.t('app.copy')"
            :aria-label="i18n.t('app.copy')"
            @click="copyToClipboard(team)"
          >
            <IconCopy :size="14" />
          </button>
          <button
            type="button"
            class="card-btn icon"
            :title="i18n.t('app.download')"
            :aria-label="i18n.t('app.download')"
            @click="downloadAsImage(team)"
          >
            <IconDownload :size="14" />
          </button>
          <button
            type="button"
            class="card-btn danger"
            :class="{ armed: armed === team.id }"
            @click="handleDelete(team)"
          >
            <ConfirmLabel :armed="armed === team.id" :label="i18n.t('app.delete')" />
          </button>
        </div>
      </div>
    </div>
    <TeamPreviewModal
      v-if="previewedTeam"
      :show="previewOpen"
      :team="previewedTeam"
      @close="previewOpen = false"
    />

    <Teleport to="body">
      <TooltipPopup
        v-if="storageHintAnchor"
        :target-element="storageHintAnchor"
        variant="detailed"
        max-width="320px"
      >
        <template #content>{{ i18n.t('app.storage-hint') }}</template>
      </TooltipPopup>
      <TooltipPopup
        v-if="actionTip && actionTipAnchor"
        :target-element="actionTipAnchor"
        variant="detailed"
      >
        <template #content>{{ actionTipText }}</template>
      </TooltipPopup>
    </Teleport>
  </div>
</template>

<style scoped>
.saved-teams {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  min-height: var(--panel-min-height);
}

@media (max-width: 768px) {
  .saved-teams {
    padding: 0 var(--panel-inset);
  }
}

.library-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--spacing-sm) var(--spacing-lg);
}

.library-info {
  display: inline-flex;
  align-items: center;
  flex: 1 1 auto;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.library-count {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.storage-hint {
  display: inline-flex;
  padding: 0;
  border: 0;
  background: none;
  color: var(--color-text-secondary);
  opacity: 0.6;
  cursor: help;
}

.storage-hint:hover,
.storage-hint:focus-visible {
  opacity: 1;
  color: var(--color-primary);
}

.library-count.warn {
  color: var(--color-warning);
}

.sort-picker {
  margin-left: var(--spacing-sm);
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-sm) var(--spacing-md);
}

.type-group {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.type-label {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--color-text-secondary);
  margin-right: 2px;
}

.type-chip {
  border: 1.5px solid var(--color-border-primary);
  background: transparent;
  border-radius: 999px;
  padding: 2px 11px;
  font-size: 0.76rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.type-chip:hover:not(.active) {
  color: var(--color-primary);
  border-color: var(--color-primary);
  background: var(--color-bg-tertiary);
}

.type-chip.active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
}

.team-search {
  flex: 1 1 120px;
  min-width: 70px;
  max-width: 260px;
  margin-left: var(--spacing-sm);
}

@media (min-width: 769px) {
  .team-search {
    max-width: 480px;
  }
}

@media (max-width: 768px) {
  .team-search {
    flex-basis: 100%;
    max-width: none;
    margin-left: 0;
  }
}

.library-actions {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.library-btn {
  padding: 4px 12px;
  font-size: 0.75rem;
  white-space: nowrap;
}

.delete-all-btn {
  background: var(--color-danger);
  border-color: var(--color-danger);
}

.delete-all-btn:hover,
.delete-all-btn.armed {
  background: var(--color-danger-hover);
  border-color: var(--color-danger-hover);
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

.team-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
  gap: var(--spacing-lg);
  align-content: start;
}

@media (max-width: 1100px) {
  .team-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .team-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

.team-card {
  background: var(--color-bg-secondary);
  border: 1.5px solid var(--color-border-primary);
  border-radius: var(--radius-large);
  padding: var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  transition: border-color var(--transition-fast);
  content-visibility: auto;
  contain-intrinsic-size: auto 460px;
}

.team-card.loaded {
  border-color: var(--color-primary);
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.preview-btn {
  display: block;
  width: 100%;
  padding: 0;
  border: none;
  background: none;
  cursor: zoom-in;
}

.preview-btn:hover :deep(.team-preview),
.preview-btn:focus-visible :deep(.team-preview) {
  background: rgba(0, 0, 0, 0.1);
}

.card-title-row {
  display: flex;
  align-items: center;
  gap: 2px;
}

.team-name {
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--color-text-primary);
  background: none;
  border: 1px dashed transparent;
  border-radius: var(--radius-small);
  padding: 0 4px;
  cursor: text;
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
}

.team-name:hover {
  border-color: var(--color-border-primary);
  background: var(--color-bg-tertiary);
}

.team-name mark {
  background: color-mix(in srgb, var(--color-primary) 15%, transparent);
  color: var(--color-primary);
  padding: 1px 3px;
  border-radius: 4px;
}

.team-name-input {
  flex: 1;
  min-width: 0;
  font: inherit;
  font-weight: 700;
  font-size: max(0.95rem, var(--field-min-font-size));
  color: var(--color-text-primary);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-small);
  padding: 0 4px;
  background: var(--color-bg-white);
}

.team-name-input:focus {
  outline: none;
}

.card-meta-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.mode-chip {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--color-primary);
  border: 1.5px solid var(--color-primary);
  border-radius: 999px;
  padding: 1px 8px;
  white-space: nowrap;
  text-transform: uppercase;
}

.card-meta {
  font-size: 0.72rem;
  color: var(--color-text-secondary);
  margin-left: auto;
}

.card-actions {
  display: flex;
  gap: var(--spacing-sm);
  margin-top: 2px;
}

.card-actions .card-btn {
  flex: 1;
}

.card-actions .card-btn.icon {
  flex: 0 0 auto;
  padding: 5px 9px;
}

.card-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--color-border-primary);
  background: var(--color-bg-primary);
  color: var(--color-text-secondary);
  border-radius: var(--radius-medium);
  padding: 5px 8px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.card-btn:hover {
  color: var(--color-primary);
  border-color: var(--color-primary);
  background: var(--color-bg-tertiary);
}

.card-btn.primary {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
}

.card-btn.primary:hover {
  background: var(--color-primary-hover);
  border-color: var(--color-primary-hover);
}

.card-btn.danger {
  color: var(--color-danger);
  border-color: var(--color-danger);
}

.card-btn.danger:hover {
  background: var(--color-danger);
  border-color: var(--color-danger);
  color: #fff;
}

.card-btn.armed,
.card-btn.armed:hover {
  background: var(--color-danger-hover);
  border-color: var(--color-danger-hover);
  color: #fff;
  box-shadow: var(--confirm-armed-ring);
}
</style>
