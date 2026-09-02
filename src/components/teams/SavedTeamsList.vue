<script setup lang="ts">
/* The Saved Teams roster panel: header (count, cap warning, sort, mode and
   one-side filters, search, and Import / Export / Delete all) plus a card grid:
   thumbnail, mode and Syn chips, inline-renamable name, relative updated time,
   and Load / Duplicate / Copy / Download / Delete actions. Destructive actions use
   the app's no-modal style: a two-step inline confirm that arms for a few
   seconds. User feedback (toasts) is fired here, not in the store. */

import { computed, ref, watch, type ComponentPublicInstance } from 'vue'

import TeamPreviewModal from '@/components/modals/TeamPreviewModal.vue'
import TeamPreview, { estimatedPreviewHeight } from '@/components/teams/TeamPreview.vue'
import IconCopy from '@/components/ui/IconCopy.vue'
import IconDownload from '@/components/ui/IconDownload.vue'
import IconEdit from '@/components/ui/IconEdit.vue'
import IconInfo from '@/components/ui/IconInfo.vue'
import MountOnVisible from '@/components/ui/MountOnVisible.vue'
import TooltipPopup from '@/components/ui/TooltipPopup.vue'
import { useArmedConfirm } from '@/composables/useArmedConfirm'
import { useHoverTooltip } from '@/composables/useHoverTooltip'
import { useInfoTip } from '@/composables/useInfoTip'
import { useInlineRename } from '@/composables/useInlineRename'
import { useSavedTeamSearch } from '@/composables/useSavedTeamSearch'
import { useThumbnailExport } from '@/composables/useThumbnailExport'
import { useToast } from '@/composables/useToast'
import { useUpdatedLabel } from '@/composables/useUpdatedLabel'
import {
  MAX_SAVED_TEAMS,
  MAX_TEAM_NAME_LENGTH,
  TEAM_MODE_ORDER,
  TEAM_MODES,
  type TeamModeKey,
} from '@/lib/teams/modes'
import { teamHasSynergy } from '@/lib/teams/preview'
import { type SavedTeam } from '@/lib/teams/savedTeam'
import { savedTeamSide } from '@/lib/teams/sideLoad'
import { useI18nStore } from '@/stores/i18n'
import { useTeamLibrary } from '@/stores/teamLibrary'
import { downloadBlob, timestampedName } from '@/utils/download'
import { readStorage, writeStorage } from '@/utils/storage'

const { loadedTeamId } = defineProps<{
  // The team the live boards were loaded from / last saved to; its card gets
  // the "Loaded" ring (the same provenance the Unsaved-changes indicator uses).
  loadedTeamId: string | null
}>()

const emit = defineEmits<{ load: [team: SavedTeam] }>()

const i18n = useI18nStore()
const library = useTeamLibrary()
const { show, success, error } = useToast()

// Device-level sort preference: last-modified first (the default) or by name.
const SORT_STORAGE_KEY = 'stargazer.teams.sort'
type SortKey = 'recent' | 'name'
const SORT_KEYS: SortKey[] = ['recent', 'name']
const sortBy = ref<SortKey>(readStorage(SORT_STORAGE_KEY) === 'name' ? 'name' : 'recent')
watch(sortBy, (value) => writeStorage(SORT_STORAGE_KEY, value))

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

const modeFiltered = computed(() =>
  modeFilter.value === 'all'
    ? sorted.value
    : sorted.value.filter((team) => team.mode === modeFilter.value),
)

// Narrows to teams the Load menu can side-load (savedTeamSide: every unit on
// one team). Like the mode filter, deliberately not persisted.
const oneSideOnly = ref(false)
const sideFiltered = computed(() =>
  oneSideOnly.value
    ? modeFiltered.value.filter((team) => savedTeamSide(team.data) !== null)
    : modeFiltered.value,
)

// Matching itself (name hit with highlight snippet, hero hit at 2+ characters)
// is the shared useSavedTeamSearch composable, also used by the Load menu.
const searchVisible = computed(() => library.count > 1)
const { query: searchQuery, results: visibleTeams } = useSavedTeamSearch(() => sideFiltered.value)
// The box hides below 2 teams; hiding also resets the query (which matching
// reads), so a leftover query can never strand the list on "no matches" with
// no visible way to clear it, and the box can't reappear pre-filtered.
watch(searchVisible, (visible) => {
  if (!visible) searchQuery.value = ''
})

const nearCap = computed(() => library.count >= MAX_SAVED_TEAMS * 0.8)

const modeChip = (team: SavedTeam): string => i18n.t(TEAM_MODES[team.mode].labelKey)

const updatedLabel = useUpdatedLabel()

// 'all' = the Delete all button; team ids arm the per-card Delete.
const { armed, confirm } = useArmedConfirm()

const handleDelete = (team: SavedTeam): void => {
  if (!confirm(team.id)) return
  library.remove(team.id)
  success(i18n.t('app.team-deleted'))
}

const handleDeleteAll = (): void => {
  if (!confirm('all')) return
  library.removeAll()
  success(i18n.t('app.teams-deleted'))
}

// The card's own thumbnail is the capture target: it already renders the
// saved data faithfully, so exporting needs no board loading. Function refs
// keyed by team id because a plain ref inside v-for binds as an array.
const { copyToClipboard, downloadAsImage } = useThumbnailExport()
const previewEls = new Map<string, HTMLElement>()
const setPreviewEl = (id: string, instance: Element | ComponentPublicInstance | null): void => {
  const el = instance instanceof Element ? instance : instance?.$el
  if (el instanceof HTMLElement) previewEls.set(id, el)
  else previewEls.delete(id)
}

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
  rename: (id, name) => library.rename(id, name),
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
// they belong in this panel rather than the boards' action row.
const fileInput = ref<HTMLInputElement>()

// A filtered export names its criteria back to the user (button label and
// tooltip before, toast after), so a partial backup can't pass for a full one.
const filterLabels = computed((): string[] => {
  const labels: string[] = []
  if (modeFilter.value !== 'all') labels.push(i18n.t(TEAM_MODES[modeFilter.value].labelKey))
  if (oneSideOnly.value) labels.push(i18n.t('app.one-side'))
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
  downloadBlob(
    new Blob([JSON.stringify(library.exportTeams(selection))], { type: 'application/json' }),
    timestampedName('stargazer-teams', 'json'),
  )
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

// Import merges into the library and never replaces it; "replace everything" is
// Delete all followed by Import.
const handleFileChosen = async (event: Event): Promise<void> => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // allow re-importing the same file
  if (!file) return
  const result = library.importTeams(await file.text())
  if (result.invalid) {
    error(i18n.t('app.import-invalid'))
    return
  }
  success(
    result.conflicts > 0
      ? i18n.t('app.import-success-conflicts', {
          imported: result.imported,
          skipped: result.skipped,
          conflicts: result.conflicts,
        })
      : i18n.t('app.import-success', { imported: result.imported, skipped: result.skipped }),
  )
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
        <div
          v-if="library.count > 1"
          class="seg-group"
          role="group"
          :aria-label="i18n.t('app.sort')"
        >
          <button
            v-for="key in SORT_KEYS"
            :key
            type="button"
            :aria-pressed="sortBy === key"
            class="seg-btn"
            :class="{ active: sortBy === key }"
            @click="sortBy = key"
          >
            {{ i18n.t(`app.sort-${key}`) }}
          </button>
        </div>
        <div class="seg-group" role="group" :aria-label="i18n.t('app.teams')">
          <button
            v-for="key in MODE_FILTERS"
            :key
            type="button"
            :aria-pressed="modeFilter === key"
            class="seg-btn"
            :class="{ active: modeFilter === key }"
            @click="modeFilter = key"
          >
            {{ key === 'all' ? i18n.t('app.all') : i18n.t(TEAM_MODES[key].labelKey) }}
          </button>
        </div>
        <div class="seg-group" role="group" :aria-label="i18n.t('app.one-side')">
          <button
            type="button"
            :aria-pressed="oneSideOnly"
            class="seg-btn"
            :class="{ active: oneSideOnly }"
            @click="oneSideOnly = !oneSideOnly"
          >
            {{ i18n.t('app.one-side') }}
          </button>
        </div>
        <input
          v-if="searchVisible"
          v-model="searchQuery"
          class="team-search"
          type="search"
          :placeholder="i18n.t('app.search-teams')"
          :aria-label="i18n.t('app.search-teams')"
          spellcheck="false"
        />
      </span>
      <span class="library-actions">
        <!-- Import stays visible at zero teams: restoring a backup into an empty
             library is exactly when it's needed. -->
        <button
          type="button"
          class="library-btn"
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
          class="library-btn"
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
          class="library-btn delete-all-btn"
          :class="{ armed: armed === 'all' }"
          @click="handleDeleteAll"
        >
          {{ armed === 'all' ? i18n.t('app.confirm') : i18n.t('app.delete-all') }}
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
        <!-- Export ref stays on TeamPreview: the capture target must exclude
             this wrapper. -->
        <button
          type="button"
          class="preview-btn"
          :title="i18n.t('app.preview')"
          :aria-label="i18n.t('app.preview')"
          @click="openPreview(team)"
        >
          <MountOnVisible :estimated-height="estimatedPreviewHeight(team.mode)">
            <TeamPreview
              :team
              :highlight-heroes="highlightHeroes"
              :ref="(instance) => setPreviewEl(team.id, instance)"
            />
          </MountOnVisible>
        </button>

        <div class="card-title-row">
          <input
            v-if="editingId === team.id"
            :ref="setNameInput"
            v-model="editingName"
            class="team-name-input"
            type="text"
            :maxlength="MAX_TEAM_NAME_LENGTH"
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
            <button
              type="button"
              class="rename-btn"
              :title="i18n.t('app.rename')"
              :aria-label="i18n.t('app.rename')"
              @click="startRename(team)"
            >
              <IconEdit :size="13" />
            </button>
          </template>
        </div>

        <div class="card-meta-row">
          <span class="mode-chip">{{ modeChip(team) }}</span>
          <span v-if="teamHasSynergy(team.data)" class="mode-chip">
            {{ i18n.t('app.synergy') }}
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
            @click="copyToClipboard(previewEls.get(team.id))"
          >
            <IconCopy :size="14" />
          </button>
          <button
            type="button"
            class="card-btn icon"
            :title="i18n.t('app.download')"
            :aria-label="i18n.t('app.download')"
            @click="downloadAsImage(previewEls.get(team.id), team.name)"
          >
            <IconDownload :size="14" />
          </button>
          <button
            type="button"
            class="card-btn danger"
            :class="{ armed: armed === team.id }"
            @click="handleDelete(team)"
          >
            {{ armed === team.id ? i18n.t('app.confirm') : i18n.t('app.delete') }}
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

/* The mobile sheet zeroes the card inset, so the panel owns its side padding
   (the same inset as the sibling maps tab). */
@media (max-width: 768px) {
  .saved-teams {
    padding: 0 var(--spacing-lg);
  }
}

.library-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  /* Three actions plus the sort picker and search box outgrow a phone-width bar. */
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

/* Sized down from TeamModePicker's segmented style to fit the library bar. */
.seg-group {
  display: inline-flex;
  margin-left: var(--spacing-sm);
  background: var(--color-bg-secondary);
  border: 1.5px solid var(--color-border-primary);
  border-radius: 999px;
  padding: 2px;
  gap: 2px;
}

.seg-btn {
  border: none;
  background: transparent;
  border-radius: 999px;
  padding: 3px 12px;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.seg-btn:hover:not(.active) {
  color: var(--color-primary);
  background: var(--color-bg-tertiary);
}

.seg-btn.active {
  background: var(--color-primary);
  color: #fff;
}

/* Widen via max-width: a larger basis wraps the bar before the box can shrink. */
.team-search {
  flex: 1 1 120px;
  min-width: 70px;
  max-width: 260px;
  margin-left: var(--spacing-sm);
  font: inherit;
  font-size: 0.8rem;
  padding: 4px 12px;
  border: 1.5px solid var(--color-border-primary);
  border-radius: 999px;
  background: var(--color-bg-white);
  color: var(--color-text-primary);
}

.team-search:focus {
  outline: none;
  border-color: var(--color-primary);
}

.library-actions {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
}

/* Solid fill (the .popover-btn treatment) so the actions stay legible beside the
   sort picker and search box sharing the bar. */
.library-btn {
  border: 2px solid var(--color-primary);
  background: var(--color-primary);
  color: #fff;
  border-radius: var(--radius-medium);
  padding: 4px 12px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.library-btn:hover {
  background: var(--color-primary-hover);
  border-color: var(--color-primary-hover);
}

/* Must stay after .library-btn: equal specificity, so source order decides. */
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
  /* The column minimum keeps cards wide enough for legible thumbnail heroes;
     wide monitors fit more columns of the same card size rather than
     stretching a fixed count. */
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
  /* Offscreen cards skip layout/paint; the placeholder box keeps scroll stable
     (auto remembers each card's real rendered size after first paint). */
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
  /* The name's own 4px side padding already separates it from the pencil. */
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
  /* Shrink-to-fit so the rename pencil sits right after the text; only a
     too-long name pushes it to the card edge (and ellipsizes). */
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
  font-size: 0.95rem;
  color: var(--color-text-primary);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-small);
  padding: 0 4px;
  background: var(--color-bg-white);
}

.team-name-input:focus {
  outline: none;
}
/* 16px floor: iOS zooms the page when a smaller field gains focus, and the
   zoom outlives the field. */
@media (pointer: coarse) {
  .team-search,
  .team-name-input {
    font-size: 1rem;
  }
}

.rename-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  border: none;
  background: none;
  border-radius: var(--radius-small);
  color: var(--color-text-secondary);
  opacity: 0.55;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.rename-btn:hover {
  opacity: 1;
  color: var(--color-primary);
  background: var(--color-bg-tertiary);
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

/* Equal-width actions so Load/Duplicate/Delete align across cards. */
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

/* Danger outline at rest (a filled button on every card reads too loud across
   a large library); the fill arrives on hover and the armed confirm step. */
.card-btn.danger {
  color: var(--color-danger);
  border-color: var(--color-danger);
}

.card-btn.danger:hover {
  background: var(--color-danger);
  border-color: var(--color-danger);
  color: #fff;
}

/* Armed step of the two-step confirm: darkened with a ring, the control bar's
   armed treatment. */
.card-btn.armed,
.card-btn.armed:hover {
  background: var(--color-danger-hover);
  border-color: var(--color-danger-hover);
  color: #fff;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-danger) 40%, transparent);
}
</style>
