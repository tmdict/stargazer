<script setup lang="ts">
/* The Saved Teams roster panel: header (count, cap warning, Delete all) plus a
   card grid — thumbnail, mode chip, inline-renamable name, relative updated
   time, and equal-width Select / Duplicate / Delete actions. Destructive
   actions use the app's no-modal style: a two-step inline confirm that arms
   for a few seconds. User feedback (toasts) is fired here, not in the store. */

import { computed, nextTick, onScopeDispose, ref } from 'vue'

import TeamPreview from '@/components/teams/TeamPreview.vue'
import { useToast } from '@/composables/useToast'
import { MAX_SAVED_TEAMS, MAX_TEAM_NAME_LENGTH, TEAM_MODES } from '@/lib/teams/modes'
import type { SavedTeam } from '@/lib/teams/savedTeam'
import { useI18nStore } from '@/stores/i18n'
import { useTeamLibrary } from '@/stores/teamLibrary'

const emit = defineEmits<{ select: [team: SavedTeam] }>()

const i18n = useI18nStore()
const library = useTeamLibrary()
const { success, error } = useToast()

const sorted = computed(() => [...library.teams].sort((a, b) => b.updatedAt - a.updatedAt))
const nearCap = computed(() => library.count >= MAX_SAVED_TEAMS * 0.8)

const modeChip = (team: SavedTeam): string => i18n.t(TEAM_MODES[team.mode].labelKey)

// Relative "updated" stamp in the chrome locale (coarsest unit: weeks).
const updatedLabel = (team: SavedTeam): string => {
  const seconds = Math.round((team.updatedAt - Date.now()) / 1000)
  const table: [Intl.RelativeTimeFormatUnit, number][] = [
    ['minute', 60],
    ['hour', 3600],
    ['day', 86400],
    ['week', 604800],
  ]
  const rtf = new Intl.RelativeTimeFormat(i18n.currentLocale, { numeric: 'auto' })
  if (-seconds < 60) return i18n.t('app.updated', { time: rtf.format(0, 'minute') })
  for (let i = table.length - 1; i >= 0; i--) {
    const [unit, size] = table[i]!
    if (-seconds >= size || i === 0) {
      return i18n.t('app.updated', { time: rtf.format(Math.ceil(seconds / size), unit) })
    }
  }
  return ''
}

/* Two-step confirms: one armed target at a time ('all' = the Delete all button),
   disarmed automatically after a beat. */
const armed = ref<string | null>(null)
let disarmTimer: ReturnType<typeof setTimeout> | undefined
onScopeDispose(() => clearTimeout(disarmTimer))

const arm = (target: string): void => {
  armed.value = target
  clearTimeout(disarmTimer)
  disarmTimer = setTimeout(() => {
    armed.value = null
  }, 3000)
}

const handleDelete = (team: SavedTeam): void => {
  if (armed.value !== team.id) {
    arm(team.id)
    return
  }
  clearTimeout(disarmTimer)
  armed.value = null
  library.remove(team.id)
  success(i18n.t('app.team-deleted'))
}

const handleDeleteAll = (): void => {
  if (armed.value !== 'all') {
    arm('all')
    return
  }
  clearTimeout(disarmTimer)
  armed.value = null
  library.removeAll()
  success(i18n.t('app.team-deleted'))
}

const handleDuplicate = (team: SavedTeam): void => {
  const copy = library.duplicate(team.id)
  if (!copy) error(i18n.t('app.teams-limit', { max: MAX_SAVED_TEAMS }))
}

const editingId = ref<string | null>(null)
const editingName = ref('')
// Function ref: a string ref inside v-for binds as an array, which would make
// focus/select silent no-ops. Only one rename input exists at a time.
const nameInput = ref<HTMLInputElement | null>(null)
const setNameInput = (el: unknown): void => {
  nameInput.value = (el as HTMLInputElement) ?? null
}

const startRename = async (team: SavedTeam): Promise<void> => {
  editingId.value = team.id
  editingName.value = team.name
  await nextTick()
  nameInput.value?.focus()
  nameInput.value?.select()
}

const commitRename = (): void => {
  if (editingId.value !== null) library.rename(editingId.value, editingName.value)
  editingId.value = null
}

const cancelRename = (): void => {
  editingId.value = null
}
</script>

<template>
  <div class="saved-teams">
    <div class="library-bar">
      <span class="library-count" :class="{ warn: nearCap }">
        {{ library.count }} / {{ MAX_SAVED_TEAMS }}
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

    <div v-else class="team-grid">
      <div v-for="team in sorted" :key="team.id" class="team-card">
        <TeamPreview :team />

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
          <button v-else type="button" class="team-name" @click="startRename(team)">
            {{ team.name }}
          </button>
          <span class="mode-chip">{{ modeChip(team) }}</span>
        </div>

        <span class="card-meta">{{ updatedLabel(team) }}</span>

        <div class="card-actions">
          <button type="button" class="card-btn primary" @click="emit('select', team)">
            {{ i18n.t('app.select') }}
          </button>
          <button type="button" class="card-btn" @click="handleDuplicate(team)">
            {{ i18n.t('app.duplicate') }}
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
  </div>
</template>

<style scoped>
.saved-teams {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  min-height: var(--panel-min-height);
}

.library-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-lg);
}

.library-count {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.library-count.warn {
  color: var(--color-warning);
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
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--spacing-lg);
  align-content: start;
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
  /* Offscreen cards skip layout/paint; the placeholder box keeps scroll stable. */
  content-visibility: auto;
  contain-intrinsic-size: 220px;
}

.team-card:hover {
  border-color: var(--color-primary);
}

.card-title-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
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
  flex: 1;
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
}

/* Equal-width actions so Select/Duplicate/Delete align across cards. */
.card-actions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-sm);
  margin-top: 2px;
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
