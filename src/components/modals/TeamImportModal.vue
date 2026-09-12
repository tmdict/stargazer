<script setup lang="ts">
/* The match screenshot import: drop result screenshots, map each one to a
   board, review what was read, name the record, and replace the boards.
   State lives in useTeamImport (module-level), so closing and reopening keeps
   the shots; the modal only renders and emits the finished plan upward. */

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

// Replacing non-empty boards is destructive, so it arms like Clear and Load.
const { armed, confirm } = useArmedConfirm()
const handleReplace = (): void => {
  if (blocked.value) return
  if (grids.rostersWouldReplace(plan.value) && !confirm('replace')) return
  saveNames()
  emit('importMatch', plan.value)
}
</script>

<template>
  <BaseModal :show="show" max-width="1000px" top-anchor @close="emit('close')">
    <h1>{{ i18n.t('app.import-title') }}</h1>
    <p class="sub">
      <span class="mode-chip">
        {{ i18n.t(TEAM_MODES[activeMode].labelKey) }} ·
        {{ i18n.t('app.import-maps-count', { count: mapCount }) }}
      </span>
      {{ i18n.t('app.import-privacy') }}
    </p>

    <p v-if="referenceStatus === 'loading'" class="note">
      {{ i18n.t('app.import-references-loading') }}
    </p>
    <p v-else-if="referenceStatus === 'failed'" class="note error">
      {{ i18n.t('app.import-failed-references') }}
    </p>

    <ImageDropZone :compact="shots.length > 0" :active="show" @add="handleAdd" />

    <TeamImportShotList
      v-if="shots.length"
      :shots
      :map-count="mapCount"
      :selected-id="selectedId"
      @select="selectedId = $event"
      @set-map="setMap"
      @remove="removeShot"
    />

    <div v-if="shots.length" class="names">
      <label class="field">
        <span>{{ i18n.t('app.import-prefix') }}</span>
        <input v-model="names.prefix" type="text" spellcheck="false" maxlength="40" />
      </label>
      <label class="field">
        <span>{{ i18n.t('app.import-left-player') }}</span>
        <input v-model="names.left" type="text" spellcheck="false" maxlength="30" />
      </label>
      <label class="field">
        <span>{{ i18n.t('app.import-right-player') }}</span>
        <input v-model="names.right" type="text" spellcheck="false" maxlength="30" />
      </label>
      <div class="field wide">
        <span>{{ i18n.t('app.import-record-name') }}</span>
        <output class="record-name" :class="{ invalid: nameInvalid }">{{
          plan.suggestedName
        }}</output>
        <small v-if="nameInvalid" class="error">{{ i18n.t('app.import-name-invalid') }}</small>
      </div>
    </div>

    <TeamImportReview
      v-if="selected?.reading"
      :shot="selected"
      :names
      @set-hero="(team, row, id) => setHero(selected!.id, team, row, id)"
      @set-level="(team, row, field, level) => setLevel(selected!.id, team, row, field, level)"
      @set-artifact="(team, id) => setArtifact(selected!.id, team, id)"
    />

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
        @click="handleReplace"
      >
        {{
          armed !== null
            ? i18n.t('app.confirm')
            : i18n.t('app.import-replace', { count: mappedCount })
        }}
      </button>
      <button type="button" class="footer-btn secondary" @click="emit('close')">
        {{ i18n.t('app.cancel') }}
      </button>
      <button v-if="learnedCount > 0" type="button" class="link-btn" @click="forgetLearned">
        {{ i18n.t('app.import-forget-learned', { count: learnedCount }) }}
      </button>
    </div>
  </BaseModal>
</template>

<style scoped>
.sub {
  color: var(--color-text-secondary);
  font-size: 0.85rem;
  margin: 0 0 var(--spacing-md);
}

.mode-chip {
  display: inline-block;
  border: 1.5px solid var(--color-border-primary);
  border-radius: 999px;
  padding: 1px 9px;
  font-size: 0.74rem;
  font-weight: 600;
  margin-right: var(--spacing-sm);
}

.note {
  font-size: 0.82rem;
  color: var(--color-text-secondary);
  margin: 0 0 var(--spacing-sm);
}

.note.error,
.error {
  color: var(--color-error);
}

.names {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm) var(--spacing-md);
  margin: var(--spacing-md) 0;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1 1 140px;
  min-width: 0;
}

.field.wide {
  flex-basis: 100%;
}

.field span {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--color-text-secondary);
}

.field input {
  font: inherit;
  font-size: 0.85rem;
  padding: 6px 8px;
  border: 1.5px solid var(--color-border-primary);
  border-radius: var(--radius-medium);
  background: var(--color-bg-white);
  color: var(--color-text-primary);
}

.field input:focus {
  outline: none;
  border-color: var(--color-primary);
}

@media (pointer: coarse) {
  .field input {
    font-size: 1rem;
  }
}

.record-name {
  font-size: 0.85rem;
  padding: 6px 8px;
  border: 1.5px dashed var(--color-border-primary);
  border-radius: var(--radius-medium);
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
  overflow-wrap: anywhere;
}

.record-name.invalid {
  border-color: var(--color-error);
}

.issues {
  margin: var(--spacing-md) 0 0;
  padding-left: 1.2em;
  font-size: 0.82rem;
  color: var(--color-text-secondary);
}

.issues .blocking {
  color: var(--color-error);
}

.footer {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  align-items: center;
  margin-top: var(--spacing-lg);
}

.footer-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--color-primary);
  background: var(--color-primary);
  color: #fff;
  border-radius: var(--radius-medium);
  min-height: 34px;
  padding: 4px 14px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.footer-btn.danger {
  background: var(--color-danger);
  border-color: var(--color-danger);
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
  background: var(--color-bg-primary);
  color: var(--color-text-secondary);
  border-color: var(--color-border-primary);
}

.link-btn {
  margin-left: auto;
  border: none;
  background: none;
  color: var(--color-text-secondary);
  font: inherit;
  font-size: 0.78rem;
  text-decoration: underline;
  cursor: pointer;
}
</style>
