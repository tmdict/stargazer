<script setup lang="ts">
/* The screenshot import, from either of two starts. A match: drop its result
   screenshots, map each one to a board, add its formation screenshots (or, in
   Supreme League when they couldn't be saved, replay frames) to put the
   heroes on their tiles, review what was read, name the record, pick the
   board sides, and save it as a new team. Or formation screenshots alone,
   each one team with the levels it shows, which closes the result drop until
   they are removed. State and everything worked out from the plan live in
   useTeamImport, and closing the modal clears it, so each opening is a new
   import. The modal only renders and emits the finished plan upward. */

import { computed, reactive, ref, watch } from 'vue'

import BaseModal from './BaseModal.vue'
import ImportLearnedReset from '@/components/import/ImportLearnedReset.vue'
import ImportProgress from '@/components/import/ImportProgress.vue'
import ImportScreenThumb from '@/components/import/ImportScreenThumb.vue'
import TeamImportReplay from '@/components/teams/TeamImportReplay.vue'
import TeamImportReview from '@/components/teams/TeamImportReview.vue'
import TeamImportShotList from '@/components/teams/TeamImportShotList.vue'
import ConfirmLabel from '@/components/ui/ConfirmLabel.vue'
import ImageDropZone from '@/components/ui/ImageDropZone.vue'
import { useArmedConfirm } from '@/composables/useArmedConfirm'
import { usePasteImages } from '@/composables/usePasteImages'
import { useTeamImport, type ImportShot } from '@/composables/useTeamImport'
import { useToast } from '@/composables/useToast'
import type { ShotKind } from '@/lib/import/screens/match/types'
import { MAX_NAME_LENGTH } from '@/lib/names'
import {
  DEFAULT_VARIANT,
  TEAM_MODES,
  TEAM_VARIANTS,
  type TeamModeKey,
  type VariantMatch,
} from '@/lib/teams/modes'
import {
  isBlockingIssue,
  NAME_FORBIDDEN,
  type PlanIssue,
  type TeamImportPlan,
} from '@/lib/teams/teamImport'
import { Team, teamLabelKey } from '@/lib/types/team'
import { useGameDataStore } from '@/stores/gameData'
import { useGrids } from '@/stores/grids'
import { useI18nStore } from '@/stores/i18n'
import { localizedDisplayName } from '@/utils/nameFormatting'

import '@/styles/import.css'

const { show, activeMode, variant } = defineProps<{
  show: boolean
  activeMode: TeamModeKey
  // The live boards' type, named beside the mode in the header.
  variant: VariantMatch
}>()

const emit = defineEmits<{
  close: []
  importMatch: [plan: TeamImportPlan, name: string]
}>()

const gameData = useGameDataStore()
const grids = useGrids()
const i18n = useI18nStore()
const { error } = useToast()
const {
  shots,
  referenceStatus,
  names,
  swapSides,
  formationSwap,
  learnedCount,
  plan,
  mapCount,
  matchImport,
  sidesSwapped,
  noResult,
  boardMap,
  cardSides,
  formationUnits,
  replaySides,
  placedSides,
  reviewCount,
  placeCount,
  addFiles,
  progress,
  removeShot,
  clearImport,
  setMap,
  setWinner,
  setHero,
  setLevel,
  setArtifact,
  setUnit,
  setTilePick,
  resultsClosed,
  formationsClosed,
  replayOpen,
  saveNames,
  forgetLearned,
  ensureReferences,
} = useTeamImport(
  () => activeMode,
  () => variant,
)

const selectedId = ref<string | null>(null)
const selected = computed(() => shots.value.find((s) => s.id === selectedId.value) ?? null)
const resultShots = computed(() => shots.value.filter((s) => s.kind === 'result'))
const formationShots = computed(() => shots.value.filter((s) => s.kind === 'formation'))
const replayShots = computed(() => shots.value.filter((s) => s.kind === 'replay'))

const noResultNotice = (shot: ImportShot): string | null =>
  noResult(shot) ? i18n.t('app.import-no-result') : null

// Keep a card selected while there are cards.
watch(
  shots,
  (list) => {
    if (!list.some((s) => s.id === selectedId.value)) selectedId.value = list[0]?.id ?? null
  },
  { immediate: true },
)

// The saved team's name: the one built from the names above until the reviewer
// types their own, which only the length limit holds; clearing it goes back.
const customName = ref<string | null>(null)
const recordName = computed(() => (customName.value ?? plan.value.suggestedName).trim())
const settleRecordName = (): void => {
  if (customName.value?.trim() === '') customName.value = null
}

// Every opening starts fresh: closing, by Save as New or otherwise, clears it.
watch(
  () => show,
  (open) => {
    if (open) void ensureReferences()
    else {
      clearImport()
      customName.value = null
    }
  },
  { immediate: true },
)

// A drop or paste opens the first of its screenshots to be read for review,
// unless another screenshot with a review was opened while they read. The
// latest drop that adds a screenshot is the one that opens.
const toOpen = ref<{ ids: string[]; before: string | null } | null>(null)
watch(
  () => {
    const ids = toOpen.value?.ids
    return ids && shots.value.find((s) => ids.includes(s.id) && s.reading)
  },
  (shot) => {
    if (!shot || !toOpen.value) return
    if (selectedId.value === toOpen.value.before || !selected.value?.reading) {
      selectedId.value = shot.id
    }
    toOpen.value = null
  },
)

const handleAdd = async (files: File[], kind: ShotKind | 'sort' = 'result'): Promise<void> => {
  const batch = reactive({ ids: [] as string[], before: selectedId.value })
  const { added, refused, skipped, closed } = await addFiles(files, kind, (id) => {
    if (batch.ids.length === 0) toOpen.value = batch
    batch.ids.push(id)
  })
  if (refused.roster) error(i18n.t('app.import-roster-shots'))
  else if (refused.matchup) error(i18n.t('app.import-matchup-shots'))
  else if (refused.result) error(i18n.t('app.import-results-closed'))
  else if (refused.formation) error(i18n.t('app.import-formations-closed'))
  else if (added === 0 && skipped === 0 && !closed) error(i18n.t('app.no-valid-images'))
}

// A paste lands in no drop area, so each pasted screenshot goes to the
// section of the kind it shows.
usePasteImages(
  () => show,
  (files) => void handleAdd(files, 'sort'),
)

const nameInvalid = computed(
  () =>
    customName.value === null &&
    plan.value.suggestedName !== '' &&
    [names.prefix, names.left, names.right].some((name) => NAME_FORBIDDEN.test(name)),
)
// The library would clip the name, losing the map lists at its end.
const nameTooLong = computed(
  () => customName.value === null && plan.value.suggestedName.length > MAX_NAME_LENGTH,
)

const heroLabel = (characterId: number): string => {
  const slug = gameData.getCharacterNameById(characterId)
  return slug ? localizedDisplayName(i18n.t, 'character', slug) : String(characterId)
}

const artifactLabel = (artifactId: number): string => {
  const artifact = gameData.getArtifactById(artifactId)
  return artifact ? localizedDisplayName(i18n.t, 'artifact', artifact.name) : String(artifactId)
}

const sideLabel = (team: Team): string => i18n.t(teamLabelKey(team))

const issueText = (issue: PlanIssue): string => {
  switch (issue.kind) {
    case 'duplicate-map':
      return i18n.t('app.import-duplicate-map', { map: issue.mapIndex + 1 })
    case 'unmapped':
      return i18n.t('app.import-unmapped', { count: issue.count })
    case 'empty':
      return i18n.t('app.import-empty', { count: issue.count })
    case 'duplicate-hero':
      return i18n.t('app.import-duplicate-hero', {
        hero: heroLabel(issue.characterId),
        side: sideLabel(issue.team),
        map: issue.mapIndex + 1,
      })
    case 'cross-board-duplicate':
      return i18n.t('app.import-cross-duplicate', {
        hero: heroLabel(issue.characterId),
        side: sideLabel(issue.team),
        maps: issue.maps.map((m) => m + 1).join(', '),
      })
    case 'cross-board-artifact':
      return i18n.t('app.import-cross-artifact', {
        artifact: artifactLabel(issue.artifactId),
        side: sideLabel(issue.team),
        maps: issue.maps.map((m) => m + 1).join(', '),
      })
    case 'result-undecided':
      return i18n.t('app.import-result-undecided')
    case 'duplicate-formation':
      return i18n.t('app.import-duplicate-formation', {
        side: sideLabel(issue.team),
        map: issue.mapIndex + 1,
      })
    case 'map-conflict':
      return i18n.t('app.import-map-conflict', { map: issue.mapIndex + 1 })
    case 'unknown-map':
      return i18n.t(issue.keepsMap ? 'app.import-unknown-map' : 'app.import-unknown-map-other', {
        map: issue.mapIndex + 1,
      })
    case 'unplaced':
      return i18n.t('app.import-unplaced', {
        count: issue.count,
        side: sideLabel(issue.team),
        map: issue.mapIndex + 1,
      })
    case 'formation-unused':
      return i18n.t('app.import-formation-unused', {
        side: sideLabel(issue.team),
        map: issue.mapIndex + 1,
      })
    case 'duplicate-replay':
      return i18n.t('app.import-duplicate-replay', { map: issue.mapIndex + 1 })
    case 'replay-unused':
      return i18n.t('app.import-replay-unused', { map: issue.mapIndex + 1 })
  }
}

const mappedCount = computed(() => plan.value.boards.filter((b) => b !== null).length)
// Files still being sorted are not shots yet, and Save waits for them too.
const reading = computed(() => progress.value !== null)
const blocked = computed(
  () =>
    mappedCount.value === 0 ||
    reading.value ||
    nameInvalid.value ||
    nameTooLong.value ||
    plan.value.issues.some(isBlockingIssue),
)

// The import starts a new team on the boards, so with content there it arms
// like New.
const { armed, confirm } = useArmedConfirm()
const handleSaveAsNew = (): void => {
  if (blocked.value) return
  if (grids.boardsHaveContent() && !confirm('save')) return
  saveNames()
  emit('importMatch', plan.value, recordName.value)
}

const handleForgetLearned = (): void => {
  if (!confirm('forget')) return
  forgetLearned()
}
</script>

<template>
  <BaseModal :show :label="i18n.t('app.import-title')" top-anchor @close="emit('close')">
    <div class="import">
      <header class="import-head">
        <h1>{{ i18n.t('app.import-title') }}</h1>
        <div class="meta">
          <span class="meta-chip">
            {{ i18n.t(TEAM_MODES[activeMode].labelKey) }}
            <template v-if="variant !== null && variant !== DEFAULT_VARIANT">
              {{ i18n.t(TEAM_VARIANTS[variant].labelKey) }}
            </template>
            · {{ i18n.t('app.import-maps-count', { count: mapCount }) }}
          </span>
          <span v-if="referenceStatus === 'loading'" class="note">
            {{ i18n.t('app.import-references-loading') }}
          </span>
          <span v-else-if="referenceStatus === 'failed'" class="note error">
            {{ i18n.t('app.import-failed-references') }}
          </span>
        </div>
        <ImportScreenThumb screen="result" />
        <p class="note intro">{{ i18n.t('app.import-tip') }}</p>
      </header>

      <section class="drop-section">
        <div class="drop-head">
          <span class="section-title">{{ i18n.t('app.import-results') }}</span>
          <span class="note">{{ i18n.t('app.import-results-tip') }}</span>
        </div>
        <ImageDropZone
          dark
          :compact="shots.length > 0"
          :disabled="resultsClosed"
          @add="handleAdd"
        />
        <ImportProgress v-if="progress" v-bind="progress" />
        <p v-if="resultsClosed" class="note closed">{{ i18n.t('app.import-results-closed') }}</p>
        <TeamImportShotList
          v-if="resultShots.length"
          v-model:selected-id="selectedId"
          :shots="resultShots"
          :map-count
          :review-count
          :place-count
          @set-map="setMap"
          @set-winner="setWinner"
          @remove="removeShot"
        />
      </section>

      <section class="drop-section">
        <div class="drop-head">
          <span class="section-title">
            {{ i18n.t('app.import-formations') }}
            <span v-if="matchImport" class="optional">{{ i18n.t('app.import-optional') }}</span>
          </span>
          <span class="note">{{ i18n.t('app.import-formations-tip') }}</span>
        </div>
        <ImageDropZone
          dark
          :compact="shots.length > 0"
          :disabled="formationsClosed"
          @add="(files) => handleAdd(files, 'formation')"
        />
        <p v-if="formationsClosed" class="note closed">
          {{ i18n.t('app.import-formations-closed') }}
        </p>
        <TeamImportShotList
          v-if="formationShots.length"
          v-model:selected-id="selectedId"
          :shots="formationShots"
          :map-count
          formation
          :review-count
          :place-count
          :notice="noResultNotice"
          @set-map="setMap"
          @remove="removeShot"
        />
      </section>

      <section v-if="replayOpen || replayShots.length" class="drop-section">
        <div class="drop-head">
          <span class="section-title">
            {{ i18n.t('app.import-replay') }}
            <span v-if="matchImport" class="optional">{{ i18n.t('app.import-optional') }}</span>
          </span>
          <span class="note">{{ i18n.t('app.import-replay-tip') }}</span>
        </div>
        <ImageDropZone
          dark
          compact
          :disabled="!replayOpen"
          @add="(files) => handleAdd(files, 'replay')"
        />
        <TeamImportShotList
          v-if="replayShots.length"
          v-model:selected-id="selectedId"
          :shots="replayShots"
          :map-count
          replay
          :review-count
          :place-count
          :notice="noResultNotice"
          @set-map="setMap"
          @remove="removeShot"
        />
      </section>

      <section v-if="matchImport" class="names">
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
        <div class="field">
          <span class="field-label">{{ i18n.t('app.import-board-sides') }}</span>
          <button
            type="button"
            class="toggle"
            :class="{ on: swapSides }"
            :aria-pressed="swapSides"
            :title="i18n.t('app.import-swap-sides-hint')"
            @click="swapSides = !swapSides"
          >
            {{ i18n.t('app.swap-sides') }}
          </button>
          <small v-if="formationSwap === swapSides" class="note">
            {{ i18n.t('app.import-sides-from-formations') }}
          </small>
        </div>
        <label class="field wide">
          <span class="field-label">{{ i18n.t('app.import-record-name') }}</span>
          <input
            class="field-input"
            :class="{ invalid: nameInvalid || nameTooLong }"
            type="text"
            spellcheck="false"
            :maxlength="MAX_NAME_LENGTH"
            :value="customName ?? plan.suggestedName"
            @input="customName = ($event.target as HTMLInputElement).value"
            @blur="settleRecordName"
          />
          <small v-if="nameInvalid" class="error">{{ i18n.t('app.import-name-invalid') }}</small>
          <small v-else-if="nameTooLong" class="error">{{
            i18n.t('app.import-name-too-long', {
              length: plan.suggestedName.length,
              max: MAX_NAME_LENGTH,
            })
          }}</small>
        </label>
      </section>

      <section v-if="selected?.reading" class="review-section">
        <div class="section-head">
          <span class="section-title">{{ i18n.t('app.import-review') }}</span>
          <span class="section-sub">{{ selected.name }}</span>
        </div>
        <!-- Keyed per shot: a picker opened on one screenshot must not
             survive into another and land its pick there. -->
        <TeamImportReview
          v-if="selected.kind === 'result'"
          :key="selected.id"
          :shot="selected"
          :names
          :swap-sides="sidesSwapped"
          @set-hero="setHero"
          @set-level="setLevel"
          @set-artifact="setArtifact"
        />
        <TeamImportReplay
          v-else-if="selected.kind === 'replay'"
          :key="`${selected.id}-replay`"
          :shot="selected"
          :map-key="boardMap(selected)"
          :sides="replaySides(selected)"
          :placed="placedSides(selected)"
          @set-pick="setTilePick"
        />
        <TeamImportReview
          v-else
          :key="`${selected.id}-formation`"
          :shot="selected"
          :names
          :swap-sides="sidesSwapped"
          :sides="cardSides(selected)"
          :units="formationUnits(selected)"
          @set-hero="setHero"
          @set-level="setLevel"
          @set-artifact="setArtifact"
          @set-unit="setUnit"
          @set-pick="setTilePick"
        />
        <ImportLearnedReset
          v-if="learnedCount > 0"
          :armed="armed === 'forget'"
          @reset="handleForgetLearned"
        />
      </section>

      <ul v-if="plan.issues.length" class="issues">
        <li
          v-for="(issue, i) in plan.issues"
          :key="i"
          :class="{ blocking: isBlockingIssue(issue) }"
        >
          {{ issueText(issue) }}
        </li>
      </ul>

      <div class="footer">
        <button
          type="button"
          class="footer-btn danger"
          :class="{ 'confirm-armed': armed === 'save' }"
          :disabled="blocked"
          @click="handleSaveAsNew"
        >
          <ConfirmLabel
            :armed="armed === 'save'"
            :label="i18n.t('app.import-save-as-new', { count: mappedCount })"
          />
        </button>
        <button type="button" class="footer-btn secondary" @click="emit('close')">
          {{ i18n.t('app.cancel') }}
        </button>
      </div>
    </div>
  </BaseModal>
</template>

<style scoped>
.import {
  --import-columns: repeat(5, minmax(0, 1fr));
}

.names {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-md) var(--spacing-lg);
}

.toggle {
  font: inherit;
  font-size: max(0.85rem, var(--field-min-font-size));
  padding: 7px 10px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: var(--radius-medium);
  background: rgba(255, 255, 255, 0.07);
  color: var(--import-text);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.toggle:hover {
  background: rgba(255, 255, 255, 0.14);
}

.toggle:focus-visible {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent) 30%, transparent);
}

.toggle.on {
  background: var(--color-accent-active);
  border-color: var(--color-accent-active);
  color: #fff;
}

.note.closed {
  margin: 0;
  color: var(--import-warn);
}

.section-title .optional {
  margin-left: 6px;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--import-label);
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
</style>
