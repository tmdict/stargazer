<script setup lang="ts">
/* The review grid for one screenshot: both sides, five cells each, with the
   card as the reader located it, the hero it matched (a picker on tap), the
   paragon / refinement pill, and a state: sure, review (amber), or not
   recognised (red). Each side also shows its artifact with a dropdown. Every
   edit is an override on the shot; nothing here touches a board. */

import { computed, ref } from 'vue'

import HeroPicker from '@/components/teams/HeroPicker.vue'
import UpgradePill from '@/components/ui/UpgradePill.vue'
import type { ImportShot } from '@/composables/useTeamImport'
import { HERO_SURE_MARGIN } from '@/lib/import/heroes'
import type { HeroReading } from '@/lib/import/types'
import { cellCharacterId, overrideKey, type RecordNames } from '@/lib/teams/teamImport'
import { Team } from '@/lib/types/team'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import { localizedDisplayName } from '@/utils/nameFormatting'

const { shot, names } = defineProps<{
  shot: ImportShot
  names: RecordNames
}>()

const emit = defineEmits<{
  setHero: [team: Team, row: number, characterId: number | null]
  setLevel: [team: Team, row: number, field: 'paragon' | 'refinement', level: number]
  setArtifact: [team: Team, artifactId: number | null]
}>()

const gameData = useGameDataStore()
const i18n = useI18nStore()

const SIDES = [Team.ALLY, Team.ENEMY] as const
const pickerFor = ref<string | null>(null)

const heroName = (characterId: number | null): string => {
  if (characterId === null) return i18n.t('app.import-no-hero')
  const slug = gameData.getCharacterNameById(characterId)
  return slug ? localizedDisplayName(i18n.t, 'character', slug) : String(characterId)
}

const heroImage = (characterId: number | null): string => {
  const slug = characterId === null ? undefined : gameData.getCharacterNameById(characterId)
  return slug ? gameData.getCharacterImage(slug) : ''
}

const artifactName = (artifactId: number | null): string => {
  if (artifactId === null) return i18n.t('app.import-no-hero')
  const slug = gameData.getArtifactById(artifactId)?.name
  return slug ? localizedDisplayName(i18n.t, 'artifact', slug) : String(artifactId)
}

type CellState = 'sure' | 'review' | 'none'

interface CellView {
  key: string
  row: number
  cell: HeroReading
  characterId: number | null
  paragon: number
  refinement: number
  state: CellState
  edited: boolean
  card: string
}

const cells = (team: Team): CellView[] => {
  const reading = shot.reading
  if (!reading) return []
  return reading.sides[team].map((cell, row) => {
    const key = overrideKey(team, row)
    const override = shot.overrides[key] ?? {}
    const characterId = cellCharacterId(reading, team, row, shot.overrides)
    const edited = shot.edited.has(key)
    const state: CellState =
      characterId === null && !edited
        ? 'none'
        : edited || cell.margin >= HERO_SURE_MARGIN
          ? 'sure'
          : 'review'
    return {
      key,
      row,
      cell,
      characterId,
      paragon: override.paragon ?? cell.paragon.level,
      refinement: override.refinement ?? cell.refinement.level,
      state,
      edited,
      card: shot.cards[key] ?? '',
    }
  })
}

const sideCells = computed(() => ({
  [Team.ALLY]: cells(Team.ALLY),
  [Team.ENEMY]: cells(Team.ENEMY),
}))

const artifactOf = (team: Team): number | null => {
  const override = shot.artifactOverrides[team]
  if (override !== undefined) return override
  return shot.reading?.artifacts[team]?.candidates[0]?.artifactId ?? null
}

const artifactSure = (team: Team): boolean => (shot.reading?.artifacts[team]?.margin ?? 0) >= 0.1

const onArtifact = (team: Team, event: Event): void => {
  const value = (event.target as HTMLSelectElement).value
  emit('setArtifact', team, value === '' ? null : Number(value))
}

const stateLabel = (state: CellState): string =>
  state === 'sure'
    ? ''
    : state === 'review'
      ? i18n.t('app.import-review')
      : i18n.t('app.import-unrecognised')
</script>

<template>
  <div class="review">
    <div v-for="team in SIDES" :key="team" class="side">
      <div class="side-head">
        <span class="side-label">{{ i18n.t(team === Team.ALLY ? 'app.ally' : 'app.enemy') }}</span>
        <span class="side-player">{{ team === Team.ALLY ? names.left : names.right }}</span>
        <label class="artifact">
          <span class="artifact-label">{{ i18n.t('app.import-artifact') }}</span>
          <select
            class="artifact-select"
            :class="{ review: !artifactSure(team) && shot.artifactOverrides[team] === undefined }"
            :value="artifactOf(team) ?? ''"
            @change="onArtifact(team, $event)"
          >
            <option value="">{{ i18n.t('app.import-no-hero') }}</option>
            <option v-for="artifact in gameData.artifacts" :key="artifact.id" :value="artifact.id">
              {{ artifactName(artifact.id) }}
            </option>
          </select>
        </label>
      </div>
      <div class="cells">
        <div v-for="view in sideCells[team]" :key="view.key" class="cell" :class="view.state">
          <div class="cell-images">
            <img v-if="view.card" class="cell-card" :src="view.card" alt="" />
            <img
              v-if="view.characterId !== null"
              class="cell-portrait"
              :src="heroImage(view.characterId)"
              alt=""
            />
            <span v-else class="cell-portrait empty" />
          </div>
          <div class="cell-name-wrap">
            <button
              type="button"
              class="cell-name"
              :title="heroName(view.characterId)"
              @click="pickerFor = pickerFor === view.key ? null : view.key"
            >
              {{ heroName(view.characterId) }}
            </button>
            <HeroPicker
              v-if="pickerFor === view.key"
              :suggestions="view.cell.candidates.map((c) => c.characterId)"
              @pick="
                (id) => {
                  emit('setHero', team, view.row, id)
                  pickerFor = null
                }
              "
              @close="pickerFor = null"
            />
          </div>
          <div class="cell-meta">
            <UpgradePill
              :paragon="view.paragon"
              :refinement="view.refinement"
              editable
              @paragon="emit('setLevel', team, view.row, 'paragon', $event)"
              @refinement="emit('setLevel', team, view.row, 'refinement', $event)"
            />
            <span v-if="view.edited" class="cell-state edited">{{
              i18n.t('app.import-edited')
            }}</span>
            <span v-else-if="view.state !== 'sure'" class="cell-state" :class="view.state">
              {{ stateLabel(view.state) }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.review {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.side-head {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
  margin-bottom: var(--spacing-xs);
}

.side-label {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-secondary);
}

.side-player {
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--color-text-primary);
}

.artifact {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}

.artifact-select {
  font: inherit;
  font-size: 0.78rem;
  border: 1.5px solid var(--color-border-primary);
  border-radius: var(--radius-medium);
  background: var(--color-bg-white);
  color: var(--color-text-primary);
  padding: 3px 6px;
  max-width: 160px;
}

.artifact-select.review {
  border-color: var(--color-warning);
  background: var(--color-warning-bg);
}

.cells {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: var(--spacing-sm);
}

@media (max-width: 720px) {
  .cells {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.cell {
  border: 1.5px solid var(--color-border-primary);
  border-radius: var(--radius-large);
  background: var(--color-bg-primary);
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}

.cell.review {
  border-color: var(--color-warning);
  background: var(--color-warning-bg);
}

.cell.none {
  border-color: var(--color-error);
  background: var(--color-error-bg);
}

.cell-images {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
}

.cell-card,
.cell-portrait {
  width: 100%;
  aspect-ratio: 74 / 104;
  object-fit: cover;
  border-radius: var(--radius-medium);
  background: #333;
  display: block;
}

.cell-portrait.empty {
  background: var(--color-bg-secondary);
}

.cell-name-wrap {
  position: relative;
}

.cell-name {
  width: 100%;
  border: 1.5px solid var(--color-border-primary);
  border-radius: var(--radius-medium);
  background: var(--color-bg-white);
  color: var(--color-text-primary);
  font: inherit;
  font-size: 0.78rem;
  font-weight: 600;
  padding: 4px 6px;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
}

.cell-name:hover,
.cell-name:focus-visible {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.cell-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  flex-wrap: wrap;
}

.cell-state {
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.cell-state.review {
  color: #8a6100;
}

.cell-state.none {
  color: var(--color-error);
}

.cell-state.edited {
  color: var(--color-primary);
}
</style>
