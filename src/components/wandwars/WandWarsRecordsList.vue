<script setup lang="ts">
import { computed, ref } from 'vue'

import { useI18nStore } from '@/stores/i18n'
import { formatName, formatNoteHtml } from '@/wandwars/formatting'
import { parseMatchData } from '@/wandwars/records/parser'
import { serializeMatches } from '@/wandwars/records/serializer'
import type { RecordedMatch } from '@/wandwars/types'

const props = defineProps<{
  records: RecordedMatch[]
  characterImages: Record<string, string>
}>()

const emit = defineEmits<{
  deleteRecord: [index: number]
  clearRecords: []
  export: []
  importRecords: [records: RecordedMatch[]]
  updateRecord: [index: number, changes: Partial<RecordedMatch>]
}>()

const i18n = useI18nStore()

const importInput = ref<HTMLInputElement | null>(null)

// Semantic state so language switches re-render the status string reactively.
type ImportStatusState =
  | { kind: 'none' }
  | { kind: 'no-records' }
  | { kind: 'imported'; count: number }
  | { kind: 'failed'; error: string }
const importStatusState = ref<ImportStatusState>({ kind: 'none' })
const importStatus = computed(() => {
  const s = importStatusState.value
  if (s.kind === 'none') return ''
  if (s.kind === 'no-records') return i18n.t('wandwars.messages/import-no-records')
  if (s.kind === 'imported') {
    const key =
      s.count === 1
        ? 'wandwars.messages/imported-record-singular'
        : 'wandwars.messages/imported-records'
    return i18n.t(key, { count: s.count })
  }
  return i18n.t('wandwars.messages/import-failed', { error: s.error })
})

// In-place editing of a single record. Tracked by object identity, not index:
// deleting a row above the edited one shifts indices, and an index-tracked edit
// would silently save onto a different record.
const editingRecord = ref<RecordedMatch | null>(null)
const editWinner = ref<'left' | 'right' | 'draw'>('left')
const editDominant = ref(false)
const editNotes = ref('')

const editResultKey = computed(() => {
  if (editWinner.value === 'draw') return 'draw'
  return `${editWinner.value}-${editDominant.value ? 'dominant' : 'normal'}`
})

function setEditResult(w: 'left' | 'right' | 'draw', d: boolean) {
  editWinner.value = w
  editDominant.value = d
}

function startEdit(record: RecordedMatch) {
  editingRecord.value = record
  editWinner.value = record.winner
  editDominant.value = record.winner !== 'draw' && record.dominant
  editNotes.value = record.notes
}

function cancelEdit() {
  editingRecord.value = null
}

function saveEdit() {
  // Resolve the record's current position at save time; -1 means it was
  // deleted while being edited
  const i = editingRecord.value ? props.records.indexOf(editingRecord.value) : -1
  if (i !== -1) {
    emit('updateRecord', i, {
      winner: editWinner.value,
      dominant: editWinner.value !== 'draw' && editDominant.value,
      notes: editNotes.value.trim(),
    })
  }
  editingRecord.value = null
}

function openImport() {
  importStatusState.value = { kind: 'none' }
  importInput.value?.click()
}

async function handleImportFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    const text = await file.text()
    // Records UI import is display-only and doesn't feed predictions. Empty
    // fallback puts the parser in lenient mode so files without `@patch`
    // directives still parse cleanly.
    const parsed = parseMatchData(text, '')
    if (parsed.length === 0) {
      importStatusState.value = { kind: 'no-records' }
      return
    }
    const imported: RecordedMatch[] = parsed.map((m) => ({
      left: m.left,
      right: m.right,
      winner: m.result,
      dominant: m.weight >= 1.5,
      notes: m.notes[0]?.text ?? '',
    }))
    emit('importRecords', imported)
    importStatusState.value = { kind: 'imported', count: imported.length }
  } catch (err) {
    importStatusState.value = { kind: 'failed', error: String(err) }
  } finally {
    if (importInput.value) importInput.value.value = ''
  }
}

const showCopiedFlash = ref(false)
const copyLabel = computed(() =>
  showCopiedFlash.value ? i18n.t('wandwars.copied') : i18n.t('wandwars.copy-data'),
)

async function handleCopy() {
  const content = serializeMatches(props.records)
  await navigator.clipboard.writeText(content)
  showCopiedFlash.value = true
  setTimeout(() => {
    showCopiedFlash.value = false
  }, 2000)
}

function recordVerbLabel(r: RecordedMatch): string {
  if (r.winner === 'draw') return i18n.t('wandwars.draw')
  return r.dominant ? i18n.t('wandwars.sweeps') : i18n.t('wandwars.beats')
}

function recordVerbKind(r: RecordedMatch): 'beats' | 'sweeps' | 'draw' {
  if (r.winner === 'draw') return 'draw'
  return r.dominant ? 'sweeps' : 'beats'
}

function recordVerbDirClass(r: RecordedMatch): string {
  if (r.winner === 'left') return 'dir-right'
  if (r.winner === 'right') return 'dir-left'
  return ''
}
</script>

<template>
  <div class="records-tab">
    <div v-if="records.length > 0" class="records-section">
      <div class="records-actions">
        <button class="export-btn" @click="handleCopy">{{ copyLabel }}</button>
        <button class="export-btn" @click="openImport">
          {{ i18n.t('wandwars.import-data') }}
        </button>
        <button class="export-btn" @click="emit('export')">
          {{ i18n.t('wandwars.export-data') }}
        </button>
        <button class="export-btn danger" @click="emit('clearRecords')">
          {{ i18n.t('wandwars.clear-all') }}
        </button>
      </div>
      <div v-if="importStatus" class="import-status">{{ importStatus }}</div>
      <div v-scroll-chain class="records-list">
        <div v-for="(record, i) in records" :key="i" class="record-entry">
          <div class="record-row">
            <div class="record-team">
              <img
                v-for="hero in record.left"
                :key="hero"
                :src="characterImages[hero]"
                :alt="hero"
                :title="formatName(hero)"
                class="record-portrait"
              />
            </div>
            <div v-if="editingRecord === record" class="record-edit-result">
              <button
                :class="[
                  'edit-result-btn',
                  'left',
                  'dominant',
                  { active: editResultKey === 'left-dominant' },
                ]"
                :title="i18n.t('wandwars.left-win-sweep')"
                @click="setEditResult('left', true)"
              >
                <svg viewBox="0 0 16 16" class="result-icon" aria-hidden="true">
                  <path
                    d="M8 3L3 8l5 5M13 3L8 8l5 5"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
              <button
                :class="['edit-result-btn', 'left', { active: editResultKey === 'left-normal' }]"
                :title="i18n.t('wandwars.left-win')"
                @click="setEditResult('left', false)"
              >
                <svg viewBox="0 0 16 16" class="result-icon" aria-hidden="true">
                  <path
                    d="M14 8H2M7 3L2 8l5 5"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
              <button
                :class="['edit-result-btn', 'draw', { active: editResultKey === 'draw' }]"
                :title="i18n.t('wandwars.draw')"
                @click="setEditResult('draw', false)"
              >
                <svg viewBox="0 0 16 16" class="result-icon" aria-hidden="true">
                  <path
                    d="M3 6h10M3 10h10"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  />
                </svg>
              </button>
              <button
                :class="['edit-result-btn', 'right', { active: editResultKey === 'right-normal' }]"
                :title="i18n.t('wandwars.right-win')"
                @click="setEditResult('right', false)"
              >
                <svg viewBox="0 0 16 16" class="result-icon" aria-hidden="true">
                  <path
                    d="M2 8h12M9 3l5 5-5 5"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
              <button
                :class="[
                  'edit-result-btn',
                  'right',
                  'dominant',
                  { active: editResultKey === 'right-dominant' },
                ]"
                :title="i18n.t('wandwars.right-win-sweep')"
                @click="setEditResult('right', true)"
              >
                <svg viewBox="0 0 16 16" class="result-icon" aria-hidden="true">
                  <path
                    d="M3 3l5 5-5 5M8 3l5 5-5 5"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
            </div>
            <span
              v-else
              :class="['record-verb', `kind-${recordVerbKind(record)}`, recordVerbDirClass(record)]"
            >
              <span>{{ recordVerbLabel(record) }}</span>
              <span
                v-if="record.winner !== 'draw'"
                :class="['record-arrow', { reverse: record.winner === 'right' }]"
              />
            </span>
            <div class="record-team">
              <img
                v-for="hero in record.right"
                :key="hero"
                :src="characterImages[hero]"
                :alt="hero"
                :title="formatName(hero)"
                class="record-portrait"
              />
            </div>
            <template v-if="editingRecord === record">
              <button class="edit-action-btn" :title="i18n.t('wandwars.save')" @click="saveEdit()">
                <svg viewBox="0 0 16 16" class="row-icon" aria-hidden="true">
                  <path
                    d="M3 8l3 3 7-7"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
              <button
                class="edit-action-btn cancel"
                :title="i18n.t('wandwars.cancel')"
                @click="cancelEdit"
              >
                <svg viewBox="0 0 16 16" class="row-icon" aria-hidden="true">
                  <path
                    d="M4 4l8 8M12 4l-8 8"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  />
                </svg>
              </button>
            </template>
            <template v-else>
              <button class="edit-btn" :title="i18n.t('wandwars.edit')" @click="startEdit(record)">
                <svg viewBox="0 0 16 16" class="row-icon" aria-hidden="true">
                  <path
                    d="M11 2l3 3L5 14H2v-3L11 2zM10 3l3 3"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
              <button
                class="delete-btn"
                :title="i18n.t('wandwars.delete')"
                @click="emit('deleteRecord', i)"
              >
                <svg viewBox="0 0 16 16" class="row-icon" aria-hidden="true">
                  <path
                    d="M4 4l8 8M12 4l-8 8"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  />
                </svg>
              </button>
            </template>
          </div>
          <textarea
            v-if="editingRecord === record"
            v-model="editNotes"
            class="record-edit-notes"
            rows="2"
            :placeholder="i18n.t('wandwars.messages/notes-placeholder')"
          />
          <div
            v-else-if="record.notes"
            class="record-note"
            v-html="formatNoteHtml(record.notes, record.left, record.right)"
          />
        </div>
      </div>
    </div>

    <div v-else class="empty-state">
      {{ i18n.t('wandwars.messages/no-matches-yet') }}
      <div class="empty-state-actions">
        <button class="export-btn" @click="openImport">
          {{ i18n.t('wandwars.import-data') }}
        </button>
      </div>
    </div>

    <input
      ref="importInput"
      type="file"
      accept=".data,text/plain"
      class="hidden-import"
      @change="handleImportFile"
    />
  </div>
</template>

<style scoped>
/* Action buttons + import status stay pinned; only the list itself scrolls. */
.records-tab {
  overflow-y: hidden;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.records-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  flex: 1;
  min-height: 0;
}

.records-actions {
  display: flex;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-sm);
  flex-wrap: wrap;
  flex-shrink: 0;
}

.import-status {
  margin-top: var(--spacing-xs);
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.records-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.record-entry {
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-medium);
  padding: var(--spacing-sm);
  background: var(--color-bg-white);
  transition: box-shadow var(--transition-fast);
}

.record-entry:hover {
  box-shadow: var(--shadow-small);
}

.record-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: 0.85rem;
  flex-wrap: wrap;
}

.record-team {
  display: flex;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.record-team:last-of-type {
  justify-content: flex-end;
}

.record-portrait {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  object-position: center 20%;
  border: 1px solid var(--color-border-light);
  flex-shrink: 0;
}

.record-verb {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  margin: 0 var(--spacing-sm);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  line-height: 1.1;
  white-space: nowrap;
}

.record-verb.kind-sweeps {
  color: var(--color-error);
  font-weight: 700;
}

/* Nudge only the arrow so the arrowhead's extra visual weight on one side
   doesn't feel off-center. Text labels stay on a common baseline across rows. */
.record-verb.dir-right .record-arrow {
  transform: translateX(-5px);
}

.record-verb.dir-left .record-arrow {
  transform: translateX(5px);
}

.record-arrow {
  display: flex;
  align-items: center;
  /* Balance the triangle on the right with empty space on the left so the
     bar's midpoint lines up with the verb label above it. */
  padding-left: 10px;
}

.record-arrow::before {
  content: '';
  display: block;
  width: 56px;
  height: 4px;
  background: var(--color-primary);
}

.record-arrow::after {
  content: '';
  display: block;
  width: 0;
  height: 0;
  border-top: 8px solid transparent;
  border-bottom: 8px solid transparent;
  border-left: 10px solid var(--color-primary);
}

.record-arrow.reverse {
  flex-direction: row-reverse;
  padding-left: 0;
  padding-right: 10px;
}

.record-arrow.reverse::after {
  border-left: none;
  border-right: 10px solid var(--color-primary);
}

.record-verb.kind-sweeps .record-arrow::before {
  background: var(--color-error);
}

.record-verb.kind-sweeps .record-arrow:not(.reverse)::after {
  border-left-color: var(--color-error);
}

.record-verb.kind-sweeps .record-arrow.reverse::after {
  border-right-color: var(--color-error);
}

.record-note {
  margin-top: var(--spacing-xs);
  padding-top: var(--spacing-xs);
  border-top: 1px solid var(--color-border-light);
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  line-height: 1.4;
}

.record-note :deep(.hero-highlight) {
  font-style: normal;
}

.record-note :deep(.hero-highlight.team-left) {
  color: var(--color-ally);
}

.record-note :deep(.hero-highlight.team-right) {
  color: var(--color-enemy);
}

.delete-btn {
  background: none;
  border: none;
  color: var(--color-danger);
  cursor: pointer;
  font-size: 0.85rem;
  padding: 2px 4px;
  border-radius: var(--radius-small);
  transition: background var(--transition-fast);
}

.delete-btn:hover {
  background: rgba(192, 91, 77, 0.1);
}

.edit-btn {
  background: none;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 0.85rem;
  padding: 2px 4px;
  border-radius: var(--radius-small);
  transition:
    background var(--transition-fast),
    color var(--transition-fast);
}

.edit-btn:hover {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
}

.edit-action-btn {
  background: none;
  border: 1px solid var(--color-border-primary);
  color: var(--color-primary);
  cursor: pointer;
  font-size: 0.85rem;
  padding: 2px 8px;
  border-radius: var(--radius-small);
  transition:
    background var(--transition-fast),
    color var(--transition-fast);
}

.edit-action-btn:hover {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.edit-action-btn.cancel {
  color: var(--color-text-secondary);
}

.edit-action-btn.cancel:hover {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  border-color: var(--color-border-primary);
}

.record-edit-result {
  display: flex;
  gap: 2px;
  margin: 0 var(--spacing-sm);
}

.edit-result-btn {
  padding: 4px;
  border: 1px solid var(--color-border-primary);
  background: var(--color-bg-white);
  color: var(--color-text-secondary);
  cursor: pointer;
  border-radius: var(--radius-small);
  width: 30px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.result-icon {
  width: 16px;
  height: 16px;
}

.row-icon {
  width: 14px;
  height: 14px;
  display: block;
}

.edit-result-btn:hover:not(.active) {
  background: var(--color-bg-secondary);
}

.edit-result-btn.left.active,
.edit-result-btn.right.active {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.edit-result-btn.left.dominant.active,
.edit-result-btn.right.dominant.active {
  background: var(--color-error);
  color: white;
  border-color: var(--color-error);
}

.edit-result-btn.draw.active {
  background: var(--color-text-secondary);
  color: white;
  border-color: var(--color-text-secondary);
}

.record-edit-notes {
  margin-top: var(--spacing-xs);
  width: 100%;
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-small);
  font-family: inherit;
  font-size: 0.85rem;
  resize: vertical;
  box-sizing: border-box;
}

.hidden-import {
  display: none;
}

.empty-state {
  text-align: center;
  color: var(--color-text-secondary);
  padding: var(--spacing-2xl);
  font-size: 0.85rem;
}

.empty-state-actions {
  margin-top: var(--spacing-md);
  display: flex;
  justify-content: center;
}

.export-btn {
  flex: 1;
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--color-bg-white);
  color: var(--color-primary);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-medium);
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  transition: background var(--transition-fast);
}

.export-btn:hover {
  background: var(--color-primary);
  color: white;
}

.export-btn.danger {
  color: var(--color-danger);
  border-color: var(--color-danger);
}

.export-btn.danger:hover {
  background: var(--color-danger);
  color: white;
}
</style>
