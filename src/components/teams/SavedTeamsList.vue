<script setup lang="ts">
/* The Saved Teams roster panel: header (count, cap warning, sort, Delete all)
   plus a card grid: thumbnail, mode chip, inline-renamable name, relative updated
   time, and Load / Duplicate / Copy / Download / Delete actions. Destructive
   actions use the app's no-modal style: a two-step inline confirm that arms
   for a few seconds. User feedback (toasts) is fired here, not in the store. */

import { computed, ref, watch, type ComponentPublicInstance } from 'vue'

import TeamPreview from '@/components/teams/TeamPreview.vue'
import IconCopy from '@/components/ui/IconCopy.vue'
import IconDownload from '@/components/ui/IconDownload.vue'
import IconEdit from '@/components/ui/IconEdit.vue'
import IconInfo from '@/components/ui/IconInfo.vue'
import TooltipPopup from '@/components/ui/TooltipPopup.vue'
import { useArmedConfirm } from '@/composables/useArmedConfirm'
import { useInlineRename } from '@/composables/useInlineRename'
import { useThumbnailExport } from '@/composables/useThumbnailExport'
import { useToast } from '@/composables/useToast'
import { MAX_SAVED_TEAMS, MAX_TEAM_NAME_LENGTH, TEAM_MODES } from '@/lib/teams/modes'
import { type SavedTeam } from '@/lib/teams/savedTeam'
import { useI18nStore } from '@/stores/i18n'
import { useTeamLibrary } from '@/stores/teamLibrary'
import { renderSnippet } from '@/utils/searchHighlight'
import { readStorage, writeStorage } from '@/utils/storage'

const { loadedTeamId } = defineProps<{
  // The team the live boards were loaded from / last saved to; its card gets
  // the "Loaded" ring (the same provenance the Unsaved-changes indicator uses).
  loadedTeamId: string | null
}>()

const emit = defineEmits<{ load: [team: SavedTeam] }>()

const i18n = useI18nStore()
const library = useTeamLibrary()
const { success, error } = useToast()

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

// The box hides below 2 teams and the filter follows it, so a leftover query
// can never strand the list on "no matches" with no visible way to clear it.
// Filtering and highlighting share renderSnippet: a card is visible exactly
// when its name carries a mark. The full-length context keeps the snippet
// unelided, so the pieces always spell the whole name.
const searchQuery = ref('')
const searchVisible = computed(() => library.count > 1)
const visibleTeams = computed(() => {
  const query = searchVisible.value ? searchQuery.value.trim() : ''
  if (!query)
    return sorted.value.map((team) => ({ team, name: { pre: team.name, match: '', post: '' } }))
  return sorted.value.flatMap((team) => {
    const name = renderSnippet(team.name, query, team.name.length)
    return name ? [{ team, name }] : []
  })
})

const nearCap = computed(() => library.count >= MAX_SAVED_TEAMS * 0.8)

const modeChip = (team: SavedTeam): string => i18n.t(TEAM_MODES[team.mode].labelKey)

const UPDATED_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['minute', 60],
  ['hour', 3600],
  ['day', 86400],
  ['week', 604800],
]

// Cached per locale: the label runs for every card on each re-render, and the
// formatter's construction is the expensive part.
const updatedFormatter = computed(
  () => new Intl.RelativeTimeFormat(i18n.currentLocale, { numeric: 'auto' }),
)

// Relative "updated" stamp in the chrome locale (coarsest unit: weeks).
const updatedLabel = (team: SavedTeam): string => {
  // 0 = record predates timestamps (validation's fallback); no stamp beats
  // "52 weeks ago".
  if (team.updatedAt === 0) return ''
  const seconds = Math.round((team.updatedAt - Date.now()) / 1000)
  const rtf = updatedFormatter.value
  if (-seconds < 60) return i18n.t('app.updated', { time: rtf.format(0, 'minute') })
  for (let i = UPDATED_UNITS.length - 1; i >= 0; i--) {
    const [unit, size] = UPDATED_UNITS[i]!
    if (-seconds >= size || i === 0) {
      return i18n.t('app.updated', { time: rtf.format(Math.ceil(seconds / size), unit) })
    }
  }
  return ''
}

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

const handleDuplicate = (team: SavedTeam): void => {
  const copy = library.duplicate(team.id)
  if (!copy) error(i18n.t('app.teams-limit', { max: MAX_SAVED_TEAMS }))
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

// The hint is keyboard-focusable, so focus/blur mirror the hover handlers.
const storageHintEl = ref<HTMLElement | null>(null)
const showStorageHint = ref(false)
</script>

<template>
  <div class="saved-teams">
    <div class="library-bar">
      <span class="library-info">
        <span class="library-count" :class="{ warn: nearCap }">
          {{ library.count }} / {{ MAX_SAVED_TEAMS }}
        </span>
        <span
          ref="storageHintEl"
          class="storage-hint"
          :aria-label="i18n.t('app.storage-hint')"
          tabindex="0"
          @mouseenter="showStorageHint = true"
          @mouseleave="showStorageHint = false"
          @focus="showStorageHint = true"
          @blur="showStorageHint = false"
        >
          <IconInfo :size="15" />
        </span>
        <div
          v-if="library.count > 1"
          class="sort-picker"
          role="group"
          :aria-label="i18n.t('app.sort')"
        >
          <button
            v-for="key in SORT_KEYS"
            :key
            type="button"
            :aria-pressed="sortBy === key"
            class="sort-seg"
            :class="{ active: sortBy === key }"
            @click="sortBy = key"
          >
            {{ i18n.t(`app.sort-${key}`) }}
          </button>
        </div>
        <input
          v-if="searchVisible"
          v-model="searchQuery"
          class="team-search"
          type="search"
          :placeholder="i18n.t('app.search-label')"
          :aria-label="i18n.t('app.search-label')"
          spellcheck="false"
        />
      </span>
      <button
        v-if="library.count > 0"
        type="button"
        class="delete-all-btn"
        :class="{ armed: armed === 'all' }"
        @click="handleDeleteAll"
      >
        {{ armed === 'all' ? i18n.t('app.confirm') : i18n.t('app.delete-all') }}
      </button>
    </div>

    <p v-if="library.count === 0" class="empty-state">
      {{ i18n.t('app.saved-teams-empty') }}
    </p>

    <p v-else-if="visibleTeams.length === 0" class="empty-state">
      {{ i18n.t('app.teams-no-matches') }}
    </p>

    <div v-else class="team-grid">
      <div
        v-for="{ team, name } in visibleTeams"
        :key="team.id"
        class="team-card"
        :class="{ loaded: team.id === loadedTeamId }"
      >
        <TeamPreview :team :ref="(instance) => setPreviewEl(team.id, instance)" />

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
          <span class="card-meta">{{ updatedLabel(team) }}</span>
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
    <Teleport to="body">
      <TooltipPopup
        v-if="showStorageHint && storageHintEl"
        :target-element="storageHintEl"
        variant="detailed"
        max-width="320px"
      >
        <template #content>
          <div class="storage-tip">{{ i18n.t('app.storage-hint') }}</div>
        </template>
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
  gap: var(--spacing-lg);
}

.library-info {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.library-count {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.storage-hint {
  display: inline-flex;
  color: var(--color-text-secondary);
  opacity: 0.6;
  cursor: help;
}

.storage-hint:hover,
.storage-hint:focus-visible {
  opacity: 1;
  color: var(--color-primary);
}

.storage-tip {
  line-height: 1.4;
  font-size: 0.85rem;
}

.library-count.warn {
  color: var(--color-warning);
}

/* Sized down from TeamModePicker's segmented style to fit the library bar. */
.sort-picker {
  display: inline-flex;
  margin-left: var(--spacing-sm);
  background: var(--color-bg-secondary);
  border: 1.5px solid var(--color-border-primary);
  border-radius: 999px;
  padding: 2px;
  gap: 2px;
}

.sort-seg {
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

.sort-seg:hover:not(.active) {
  color: var(--color-primary);
  background: var(--color-bg-tertiary);
}

.sort-seg.active {
  background: var(--color-primary);
  color: #fff;
}

.team-search {
  flex: 0 1 150px;
  min-width: 70px;
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

.delete-all-btn {
  border: 2px solid var(--color-border-primary);
  background: var(--color-bg-primary);
  color: var(--color-text-secondary);
  border-radius: var(--radius-medium);
  padding: 4px 12px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.delete-all-btn:hover,
.delete-all-btn.armed {
  color: #fff;
  background: var(--color-danger);
  border-color: var(--color-danger);
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
  background: none;
  color: var(--color-primary);
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

.card-btn.danger:hover {
  color: var(--color-danger);
  border-color: var(--color-danger);
  background: var(--color-bg-primary);
}

.card-btn.armed,
.card-btn.armed:hover {
  background: var(--color-danger);
  border-color: var(--color-danger);
  color: #fff;
}
</style>
