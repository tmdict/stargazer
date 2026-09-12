<script setup lang="ts">
/* The match screenshot import: drop result screenshots, map each one to a
   board, review what was read, name the record, and save it as a new team on
   the boards. State lives in useTeamImport (module-level), so closing and
   reopening keeps the shots; the modal only renders and emits the finished
   plan upward. */

import { computed, ref, watch } from 'vue'

import BaseModal from './BaseModal.vue'
import TeamImportReview from '@/components/teams/TeamImportReview.vue'
import TeamImportShotList from '@/components/teams/TeamImportShotList.vue'
import ImageDropZone from '@/components/ui/ImageDropZone.vue'
import { useArmedConfirm } from '@/composables/useArmedConfirm'
import { useTeamImport } from '@/composables/useTeamImport'
import { useToast } from '@/composables/useToast'
import { TEAM_MODES, type TeamModeKey } from '@/lib/teams/modes'
import { NAME_FORBIDDEN, type PlanIssue, type TeamImportPlan } from '@/lib/teams/teamImport'
import { Team } from '@/lib/types/team'
import { useGameDataStore } from '@/stores/gameData'
import { useGrids } from '@/stores/grids'
import { useI18nStore } from '@/stores/i18n'
import { localizedDisplayName } from '@/utils/nameFormatting'

const { show, activeMode } = defineProps<{
  show: boolean
  activeMode: TeamModeKey
}>()

const emit = defineEmits<{
  close: []
  importMatch: [plan: TeamImportPlan]
}>()

const gameData = useGameDataStore()
const grids = useGrids()
const i18n = useI18nStore()
const { error } = useToast()
const {
  shots,
  referenceStatus,
  names,
  learnedCount,
  plan,
  addFiles,
  removeShot,
  setMap,
  setWinner,
  setHero,
  setLevel,
  setArtifact,
  saveNames,
  forgetLearned,
  ensureReferences,
} = useTeamImport(() => activeMode)

const mapCount = computed(() => TEAM_MODES[activeMode].boardCount)
const selectedId = ref<string | null>(null)
const selected = computed(() => shots.value.find((s) => s.id === selectedId.value) ?? null)

// Keep a card selected while there are cards; a new drop selects its first shot.
watch(
  shots,
  (list) => {
    if (!list.some((s) => s.id === selectedId.value)) selectedId.value = list[0]?.id ?? null
  },
  { immediate: true },
)

watch(
  () => show,
  (open) => {
    if (open) void ensureReferences()
  },
  { immediate: true },
)

const handleAdd = async (files: File[]): Promise<void> => {
  const added = await addFiles(files)
  if (added === 0) error(i18n.t('app.no-valid-images'))
}

const nameInvalid = computed(
  () => NAME_FORBIDDEN.test(names.left) || NAME_FORBIDDEN.test(names.right),
)
const namesMissing = computed(() => names.left.trim() === '' || names.right.trim() === '')

const heroLabel = (characterId: number): string => {
  const slug = gameData.getCharacterNameById(characterId)
  return slug ? localizedDisplayName(i18n.t, 'character', slug) : String(characterId)
}

const issueText = (issue: PlanIssue): string => {
  switch (issue.kind) {
    case 'duplicate-map':
      return i18n.t('app.import-duplicate-map', { map: issue.mapIndex + 1 })
    case 'unmapped':
      return i18n.t('app.import-unmapped', { count: issue.count })
    case 'cross-board-duplicate':
      return i18n.t('app.import-cross-duplicate', {
        hero: heroLabel(issue.characterId),
        side: i18n.t(issue.team === Team.ALLY ? 'app.ally' : 'app.enemy'),
        maps: issue.maps.map((m) => m + 1).join(', '),
      })
  }
}

const mappedCount = computed(() => plan.value.boards.filter((b) => b !== null).length)
const blocked = computed(
  () =>
    mappedCount.value === 0 ||
    nameInvalid.value ||
    plan.value.issues.some((i) => i.kind === 'duplicate-map' || i.kind === 'cross-board-duplicate'),
)

// The new team lands on the boards, so with content there it arms like
// Clear and Load.
const { armed, confirm } = useArmedConfirm()
const handleSaveAsNew = (): void => {
  if (blocked.value) return
  if (grids.rostersWouldReplace(plan.value) && !confirm('save')) return
  saveNames()
  emit('importMatch', plan.value)
}
</script>

<template>
  <BaseModal :show="show" max-width="1000px" top-anchor @close="emit('close')">
    <div class="import">
      <h1>{{ i18n.t('app.import-title') }}</h1>
      <div class="meta">
        <span class="meta-chip">
          {{ i18n.t(TEAM_MODES[activeMode].labelKey) }} ·
          {{ i18n.t('app.import-maps-count', { count: mapCount }) }}
        </span>
        <span v-if="referenceStatus === 'loading'" class="note">
          {{ i18n.t('app.import-references-loading') }}
        </span>
        <span v-else-if="referenceStatus === 'failed'" class="note error">
          {{ i18n.t('app.import-failed-references') }}
        </span>
      </div>

      <ImageDropZone dark :compact="shots.length > 0" :active="show" @add="handleAdd" />

      <TeamImportShotList
        v-if="shots.length"
        :shots
        :map-count="mapCount"
        :names
        :selected-id="selectedId"
        @select="selectedId = $event"
        @set-map="setMap"
        @set-winner="setWinner"
        @remove="removeShot"
      />

      <section v-if="shots.length" class="names">
        <label class="field">
          <span class="field-label">{{ i18n.t('app.import-prefix') }}</span>
          <input
            v-model="names.prefix"
            class="field-input"
            type="text"
            spellcheck="false"
            maxlength="40"
          />
        </label>
        <label class="field">
          <span class="field-label">{{ i18n.t('app.import-left-player') }}</span>
          <input
            v-model="names.left"
            class="field-input"
            type="text"
            spellcheck="false"
            maxlength="30"
          />
        </label>
        <label class="field">
          <span class="field-label">{{ i18n.t('app.import-right-player') }}</span>
          <input
            v-model="names.right"
            class="field-input"
            type="text"
            spellcheck="false"
            maxlength="30"
          />
        </label>
        <div class="field wide">
          <span class="field-label">{{ i18n.t('app.import-record-name') }}</span>
          <output class="record-name" :class="{ invalid: nameInvalid }">{{
            plan.suggestedName
          }}</output>
          <small v-if="nameInvalid" class="error">{{ i18n.t('app.import-name-invalid') }}</small>
        </div>
      </section>

      <section v-if="selected?.reading" class="review-section">
        <div class="section-head">
          <span class="section-title">{{ i18n.t('app.import-review') }}</span>
          <span class="section-sub">{{ selected.name }}</span>
        </div>
        <TeamImportReview
          :shot="selected"
          :names
          @set-hero="(team, row, id) => setHero(selected!.id, team, row, id)"
          @set-level="(team, row, field, level) => setLevel(selected!.id, team, row, field, level)"
          @set-artifact="(team, id) => setArtifact(selected!.id, team, id)"
        />
      </section>

      <ul v-if="plan.issues.length" class="issues">
        <li
          v-for="(issue, i) in plan.issues"
          :key="i"
          :class="{ blocking: issue.kind !== 'unmapped' }"
        >
          {{ issueText(issue) }}
        </li>
      </ul>

      <div class="footer">
        <button
          type="button"
          class="footer-btn danger"
          :class="{ armed: armed !== null }"
          :disabled="blocked || namesMissing"
          @click="handleSaveAsNew"
        >
          {{
            armed !== null
              ? i18n.t('app.confirm')
              : i18n.t('app.import-save-as-new', { count: mappedCount })
          }}
        </button>
        <button type="button" class="footer-btn secondary" @click="emit('close')">
          {{ i18n.t('app.cancel') }}
        </button>
        <button v-if="learnedCount > 0" type="button" class="link-btn" @click="forgetLearned">
          {{ i18n.t('app.import-forget-learned', { count: learnedCount }) }}
        </button>
      </div>
    </div>
  </BaseModal>
</template>

<style scoped>
/* One palette for the import's own pieces (shot list, review) on the modal's
   dark glass: white text at a few opacities, frosted fills, the accent for
   selection, and the game's result colours. Set here so the children inherit. */
.import {
  --import-text: #fff;
  --import-text-dim: rgba(255, 255, 255, 0.65);
  --import-label: rgba(255, 255, 255, 0.55);
  --import-surface: rgba(255, 255, 255, 0.06);
  --import-surface-hover: rgba(255, 255, 255, 0.12);
  --import-border: rgba(255, 255, 255, 0.14);
  --import-border-strong: rgba(255, 255, 255, 0.3);
  --import-warn: #f6c453;
  --import-warn-tint: rgba(246, 196, 83, 0.12);
  --import-bad: #f28b82;
  --import-bad-tint: rgba(242, 139, 130, 0.14);
  --import-left: #d9782f;
  --import-right: #4f78c0;

  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  color: var(--import-text);
}

.import h1 {
  margin: 0;
}

.meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-sm);
}

.note {
  font-size: 0.82rem;
  color: var(--import-text-dim);
}

.error {
  color: var(--import-bad);
}

.names {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-md) var(--spacing-lg);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1 1 160px;
  min-width: 0;
}

.field.wide {
  flex-basis: 100%;
}

.field-label {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--import-label);
}

.field-input {
  font: inherit;
  font-size: 0.85rem;
  padding: 7px 10px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: var(--radius-medium);
  background: rgba(255, 255, 255, 0.07);
  color: var(--import-text);
}

.field-input:focus {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent) 30%, transparent);
}

/* 16px floor: iOS zooms the page when a smaller field gains focus, and the
   zoom outlives the field. */
@media (pointer: coarse) {
  .field-input {
    font-size: 1rem;
  }
}

.record-name {
  font-size: 0.85rem;
  padding: 7px 10px;
  border: 1px dashed rgba(255, 255, 255, 0.25);
  border-radius: var(--radius-medium);
  background: var(--import-surface);
  color: var(--import-text);
  overflow-wrap: anywhere;
}

.record-name.invalid {
  border-color: var(--import-bad);
}

.review-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  padding-top: var(--spacing-lg);
  border-top: 1px solid var(--import-border);
}

.section-head {
  display: flex;
  align-items: baseline;
  gap: var(--spacing-sm);
}

.section-title {
  font-size: 0.95rem;
  font-weight: 600;
}

.section-sub {
  font-size: 0.8rem;
  color: var(--import-text-dim);
}

.issues {
  margin: 0;
  padding-left: 1.2em;
  font-size: 0.82rem;
}

.issues li {
  margin: 4px 0;
  color: var(--import-text-dim);
}

.issues .blocking {
  color: var(--import-bad);
}

.footer {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  align-items: center;
  padding-top: var(--spacing-lg);
  border-top: 1px solid var(--import-border);
}

.footer-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 34px;
  padding: 4px 14px;
  border: 1px solid transparent;
  border-radius: var(--radius-medium);
  font: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.footer-btn.danger {
  background: var(--color-danger);
  border-color: var(--color-danger);
  color: #fff;
}

.footer-btn.danger:hover:not(:disabled) {
  background: var(--color-danger-hover);
  border-color: var(--color-danger-hover);
}

.footer-btn.danger.armed {
  background: var(--color-danger-hover);
  border-color: var(--color-danger-hover);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-danger) 40%, transparent);
}

.footer-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.footer-btn.secondary {
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(255, 255, 255, 0.2);
  color: var(--import-text);
}

.footer-btn.secondary:hover {
  background: rgba(255, 255, 255, 0.14);
}

.link-btn {
  margin-left: auto;
  border: none;
  background: none;
  color: var(--import-text-dim);
  font: inherit;
  font-size: 0.78rem;
  text-decoration: underline;
  cursor: pointer;
}

.link-btn:hover {
  color: var(--import-text);
}
</style>
