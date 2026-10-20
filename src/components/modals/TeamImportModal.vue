<script setup lang="ts">
/* The screenshot import, from either of two starts. A match: drop its result
   screenshots, map each one to a board, add its formation screenshots (or, in
   Supreme League when they couldn't be saved, replay frames) to put the
   heroes on their tiles, review what was read, name the record, pick the
   board sides, and save it as a new team. Or formation screenshots alone,
   each one team with the levels it shows, which closes the result drop until
   they are removed. State lives in useTeamImport, and closing the modal
   clears it, so each opening is a new import. The modal only renders and
   emits the finished plan upward. */

import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import BaseModal from './BaseModal.vue'
import TeamImportReplay from '@/components/teams/TeamImportReplay.vue'
import TeamImportReview from '@/components/teams/TeamImportReview.vue'
import TeamImportShotList from '@/components/teams/TeamImportShotList.vue'
import ImageDropZone from '@/components/ui/ImageDropZone.vue'
import { useArmedConfirm } from '@/composables/useArmedConfirm'
import { shotMapIndex, useTeamImport, type ImportShot } from '@/composables/useTeamImport'
import { useToast } from '@/composables/useToast'
import { getOpposingTeam } from '@/lib/characters/character'
import { companionIdsOf } from '@/lib/characters/companion'
import { toPhantimalId } from '@/lib/characters/phantimal'
import { isFormationReading, type ShotKind } from '@/lib/import/types'
import { DEFAULT_MAP_KEY } from '@/lib/maps'
import { MAX_NAME_LENGTH } from '@/lib/names'
import {
  DEFAULT_VARIANT,
  newTeamMaps,
  TEAM_MODES,
  TEAM_VARIANTS,
  type TeamModeKey,
  type VariantMatch,
} from '@/lib/teams/modes'
import type { SideLoadBoard } from '@/lib/teams/sideLoad'
import {
  artifactState,
  isBlockingIssue,
  NAME_FORBIDDEN,
  reviewStates,
  SIDES,
  type PlanIssue,
  type TeamImportPlan,
} from '@/lib/teams/teamImport'
import { Team, teamLabelKey } from '@/lib/types/team'
import { useGameDataStore } from '@/stores/gameData'
import { useGrids } from '@/stores/grids'
import { useI18nStore } from '@/stores/i18n'
import { imageFilesFromPaste } from '@/utils/imageFile'
import { localizedDisplayName } from '@/utils/nameFormatting'

const { show, activeMode, variant } = defineProps<{
  show: boolean
  activeMode: TeamModeKey
  // The live boards' type, named beside the mode in the header.
  variant: VariantMatch
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
  swapSides,
  learnedCount,
  plan,
  addFiles,
  removeShot,
  clearImport,
  setMap,
  setWinner,
  setHero,
  setLevel,
  setArtifact,
  setUnit,
  setTilePick,
  unitsOf,
  resultsClosed,
  formationsClosed,
  replayOpen,
  saveNames,
  forgetLearned,
  ensureReferences,
} = useTeamImport(
  () => activeMode,
  // Replay frames are read in the Supreme League arena alone.
  () => variant === 'sl',
)

const mapCount = computed(() => TEAM_MODES[activeMode].boardCount)
const selectedId = ref<string | null>(null)
const selected = computed(() => shots.value.find((s) => s.id === selectedId.value) ?? null)
const resultShots = computed(() => shots.value.filter((s) => s.kind === 'result'))
const formationShots = computed(() => shots.value.filter((s) => s.kind === 'formation'))
const replayShots = computed(() => shots.value.filter((s) => s.kind === 'replay'))
// Result shots make the import a match, whose formation shots only place its
// heroes; formation shots dropped first are imported alone.
const matchImport = computed(() => resultShots.value.length > 0)

// ---------- formation shots ----------

// The board side a formation shot fills: the team it shows, which fought from
// that side whether or not the match's sides are swapped.
const formationSide = (shot: ImportShot): Team | null =>
  shot.reading && isFormationReading(shot.reading) ? shot.reading.side : null

// In a match import, a formation shot or replay frame of a map with no result
// shot places nothing.
const noResultNotice = (shot: ImportShot): string | null => {
  if (!matchImport.value) return null
  const mapIndex = shotMapIndex(shot, mapCount.value)
  const hasResult = resultShots.value.some((s) => shotMapIndex(s, mapCount.value) === mapIndex)
  return hasResult ? null : i18n.t('app.import-no-result')
}

const boardHeroes = (mapIndex: number | null, side: Team | null): number[] =>
  mapIndex === null || side === null
    ? []
    : (plan.value.boards[mapIndex]?.sides[side]?.mains.map((unit) => unit.unitId) ?? [])

// The units a side can field: its heroes with their companions, and the
// season's phantimals with theirs.
const fieldable = (heroes: readonly number[]): number[] =>
  [...heroes, ...gameData.phantimals.map(({ id }) => toPhantimalId(id))].flatMap((id) => [
    id,
    ...companionIdsOf(id),
  ])

// The units a formation shot's portraits can be.
const unitOptions = (shot: ImportShot): number[] =>
  fieldable(boardHeroes(shotMapIndex(shot, mapCount.value), formationSide(shot)))

// A formation shot's own cards give the lineup only when imported alone.
const cardSides = (shot: ImportShot): Team[] => {
  const side = shot.reading && isFormationReading(shot.reading) ? shot.reading.side : null
  return side === null || matchImport.value ? [] : [side]
}

// The side a formation shot fills, as the plan places it, on the map it lands on.
const placedSide = (
  shot: ImportShot,
): { mapKey: string; team: Team; side: SideLoadBoard } | null => {
  const mapIndex = shotMapIndex(shot, mapCount.value)
  const team = formationSide(shot)
  if (mapIndex === null || team === null) return null
  const board = plan.value.boards[mapIndex]
  const side = board?.sides[team]
  if (!board || !side) return null
  return { mapKey: boardMap(mapIndex) ?? DEFAULT_MAP_KEY, team, side }
}

// ---------- replay frames ----------

// The map a board stands on: the one its formation shots name, else the new
// team's for that board.
const boardMap = (mapIndex: number | null): string | null =>
  mapIndex === null
    ? null
    : (plan.value.boards[mapIndex]?.map ?? newTeamMaps(activeMode, variant)[mapIndex] ?? null)

// A replay frame's teams by screenshot column, each with the heroes its
// board side takes from the map's result screenshot.
const replayColumns = (shot: ImportShot): Record<Team, { heroes: number[]; options: number[] }> => {
  const mapIndex = shotMapIndex(shot, mapCount.value)
  const column = (team: Team) => {
    const heroes = boardHeroes(mapIndex, swapSides.value ? getOpposingTeam(team) : team)
    return { heroes, options: fieldable(heroes) }
  }
  return { [Team.ALLY]: column(Team.ALLY), [Team.ENEMY]: column(Team.ENEMY) }
}

const placedSides = (shot: ImportShot): Partial<Record<Team, SideLoadBoard>> | null => {
  const mapIndex = shotMapIndex(shot, mapCount.value)
  return (mapIndex === null ? null : plan.value.boards[mapIndex]?.sides) ?? null
}

// Heroes not yet placed on a tile of their frame.
const replayReview = (shot: ImportShot): number => {
  const columns = replayColumns(shot)
  return SIDES.reduce((n, column) => {
    const picked = Object.values(shot.tilePicks[column] ?? {})
    return n + columns[column].heroes.filter((id) => !picked.includes(id)).length
  }, 0)
}

const formationReview = (shot: ImportShot): number => {
  const units = unitsOf(shot.id).filter((u) => u.state !== 'sure').length
  return cardSides(shot).reduce(
    (n, side) =>
      n +
      reviewStates(shot.reading!, side, shot.overrides).filter((st) => st !== 'sure').length +
      (artifactState(shot.reading!, side, shot.artifactOverrides) === 'review' ? 1 : 0),
    units,
  )
}

// Keep a card selected while there are cards; a new drop selects its first shot.
watch(
  shots,
  (list) => {
    if (!list.some((s) => s.id === selectedId.value)) selectedId.value = list[0]?.id ?? null
  },
  { immediate: true },
)

// Every opening starts fresh: closing, by Save as New or otherwise, clears it.
watch(
  () => show,
  (open) => {
    if (open) void ensureReferences()
    else clearImport()
  },
  { immediate: true },
)

const handleAdd = async (files: File[], kind: ShotKind | 'sort' = 'result'): Promise<void> => {
  const { added, refused } = await addFiles(files, kind)
  if (refused.result) error(i18n.t('app.import-results-closed'))
  else if (refused.formation) error(i18n.t('app.import-formations-closed'))
  else if (added === 0) error(i18n.t('app.no-valid-images'))
}

// A paste lands in no drop area, so each pasted screenshot goes to the
// section of the kind it shows.
const handlePaste = (event: ClipboardEvent): void => {
  if (!show) return
  const files = imageFilesFromPaste(event)
  if (!files.length) return
  event.preventDefault()
  void handleAdd(files, 'sort')
}

onMounted(() => window.addEventListener('paste', handlePaste))
onUnmounted(() => window.removeEventListener('paste', handlePaste))

const nameInvalid = computed(
  () =>
    plan.value.suggestedName !== '' &&
    [names.prefix, names.left, names.right].some((name) => NAME_FORBIDDEN.test(name)),
)
// The library would clip the name, losing the map lists at its end.
const nameTooLong = computed(() => plan.value.suggestedName.length > MAX_NAME_LENGTH)

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
const reading = computed(() => shots.value.some((s) => s.status === 'reading'))
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
  emit('importMatch', plan.value)
}

const handleForgetLearned = (): void => {
  if (!confirm('forget')) return
  forgetLearned()
}
</script>

<template>
  <BaseModal
    :show
    :label="i18n.t('app.import-title')"
    max-width="1000px"
    top-anchor
    @close="emit('close')"
  >
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
          :paste-active="false"
          :disabled="resultsClosed"
          @add="handleAdd"
        />
        <p v-if="resultsClosed" class="note closed">{{ i18n.t('app.import-results-closed') }}</p>
        <TeamImportShotList
          v-if="resultShots.length"
          v-model:selected-id="selectedId"
          :shots="resultShots"
          :map-count
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
          :paste-active="false"
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
          :review-count="formationReview"
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
          :paste-active="false"
          :disabled="!replayOpen"
          @add="(files) => handleAdd(files, 'replay')"
        />
        <TeamImportShotList
          v-if="replayShots.length"
          v-model:selected-id="selectedId"
          :shots="replayShots"
          :map-count
          replay
          :review-count="replayReview"
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
            {{ i18n.t('app.import-swap-sides') }}
          </button>
        </div>
        <div class="field wide">
          <span id="import-record-name" class="field-label">{{
            i18n.t('app.import-record-name')
          }}</span>
          <output
            class="record-name"
            :class="{ invalid: nameInvalid || nameTooLong }"
            aria-labelledby="import-record-name"
            >{{ plan.suggestedName }}</output
          >
          <small v-if="nameInvalid" class="error">{{ i18n.t('app.import-name-invalid') }}</small>
          <small v-else-if="nameTooLong" class="error">{{
            i18n.t('app.import-name-too-long', {
              length: plan.suggestedName.length,
              max: MAX_NAME_LENGTH,
            })
          }}</small>
        </div>
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
          :swap-sides
          @set-hero="setHero"
          @set-level="setLevel"
          @set-artifact="setArtifact"
        />
        <TeamImportReplay
          v-else-if="selected.kind === 'replay'"
          :key="`${selected.id}-replay`"
          :shot="selected"
          :map-key="boardMap(shotMapIndex(selected, mapCount))"
          :columns="replayColumns(selected)"
          :swap-sides
          :placed="placedSides(selected)"
          @set-pick="setTilePick"
        />
        <TeamImportReview
          v-else
          :key="`${selected.id}-formation`"
          :shot="selected"
          :names
          :swap-sides
          :sides="cardSides(selected)"
          :units="{
            assignments: unitsOf(selected.id),
            options: unitOptions(selected),
            placed: placedSide(selected),
          }"
          @set-hero="setHero"
          @set-level="setLevel"
          @set-artifact="setArtifact"
          @set-unit="setUnit"
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
          :class="{ armed: armed === 'save' }"
          :disabled="blocked"
          @click="handleSaveAsNew"
        >
          {{
            armed === 'save'
              ? i18n.t('app.confirm')
              : i18n.t('app.import-save-as-new', { count: mappedCount })
          }}
        </button>
        <button type="button" class="footer-btn secondary" @click="emit('close')">
          {{ i18n.t('app.cancel') }}
        </button>
        <button
          v-if="learnedCount > 0"
          type="button"
          class="link-btn"
          :class="{ armed: armed === 'forget' }"
          @click="handleForgetLearned"
        >
          {{
            armed === 'forget'
              ? i18n.t('app.confirm')
              : i18n.t('app.import-forget-learned', { count: learnedCount })
          }}
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

.import-head {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
}

.meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
}

.note {
  font-size: 0.82rem;
  color: var(--import-text-dim);
}

.error {
  color: var(--import-bad);
}

.intro {
  max-width: 42em;
  margin: 0;
  text-align: center;
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
  font-size: max(0.85rem, var(--field-min-font-size));
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

/* The inputs' metrics, so the row stays level. */
.toggle {
  padding: 7px 10px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: var(--radius-medium);
  background: rgba(255, 255, 255, 0.07);
  color: var(--import-text);
  font: inherit;
  font-size: max(0.85rem, var(--field-min-font-size));
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

.drop-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.drop-head {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.note.closed {
  margin: 0;
  color: var(--import-warn);
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

.section-title .optional {
  margin-left: 6px;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--import-label);
}

.section-sub {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

.link-btn.armed {
  color: var(--import-bad);
}

@media (pointer: coarse) {
  .link-btn {
    min-height: 32px;
  }
}
</style>
