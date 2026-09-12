<script setup lang="ts">
/* The review grid for one screenshot: both sides, five cells each, with the
   card as the reader located it, the hero it matched, the paragon /
   refinement pill, and a state: sure, review (amber), or not recognised
   (red). The name opens the grid's own character palette with the reader's
   candidates pinned first. Each side also shows its artifact with a dropdown.
   Every edit is an override on the shot; nothing here touches a board. */

import { computed, ref } from 'vue'

import CharacterSelectionPalette from '@/components/CharacterSelectionPalette.vue'
import SelectionPopup from '@/components/ui/SelectionPopup.vue'
import UpgradePill from '@/components/ui/UpgradePill.vue'
import type { ImportShot } from '@/composables/useTeamImport'
import { isBaseHeroId } from '@/lib/characters/character'
import { compareFaction } from '@/lib/filterOrder'
import type { HeroReading } from '@/lib/import/types'
import { cellCharacterId, overrideKey, type RecordNames } from '@/lib/teams/teamImport'
import type { CharacterType } from '@/lib/types/character'
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
      characterId === null && !edited ? 'none' : edited || cell.sure ? 'sure' : 'review'
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

// ---------- hero picker ----------

// Every real hero in roster order; a cell may take any of them, since the
// review is board-free and page-wide uniqueness is settled on Replace.
const heroes = computed(() =>
  gameData.characters
    .filter((c) => isBaseHeroId(c.id) && !c.placeholder)
    .sort((a, b) => compareFaction(a.faction, b.faction) || a.id - b.id),
)

interface PickerTarget {
  team: Team
  row: number
  key: string
  position: { x: number; y: number }
}

const picker = ref<PickerTarget | null>(null)

const togglePicker = (team: Team, row: number, key: string, event: MouseEvent): void => {
  if (picker.value?.key === key) {
    picker.value = null
    return
  }
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  picker.value = { team, row, key, position: { x: rect.left, y: rect.bottom + 4 } }
}

const pickerCell = computed(() => {
  const target = picker.value
  return target ? (shot.reading?.sides[target.team][target.row] ?? null) : null
})

const pinned = computed(() =>
  (pickerCell.value?.candidates ?? [])
    .map((c) => gameData.getCharacterById(c.characterId))
    .filter((c): c is CharacterType => c !== undefined),
)

const pickerHasHero = computed(() => {
  const target = picker.value
  return (
    target !== null &&
    shot.reading !== null &&
    cellCharacterId(shot.reading, target.team, target.row, shot.overrides) !== null
  )
})

const setPicked = (characterId: number | null): void => {
  const target = picker.value
  if (!target) return
  emit('setHero', target.team, target.row, characterId)
  picker.value = null
}

// ---------- artifacts ----------

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
          <button
            type="button"
            class="cell-name"
            :class="{ open: picker?.key === view.key }"
            :title="heroName(view.characterId)"
            @click="togglePicker(team, view.row, view.key, $event)"
          >
            {{ heroName(view.characterId) }}
          </button>
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

    <!-- Outside the modal's container, so its clicks and Escape are stopped
         here rather than reaching the modal's own close listeners on document. -->
    <Teleport to="body">
      <SelectionPopup
        v-if="picker"
        :position="picker.position"
        over-modal
        @close="picker = null"
        @click.stop
        @keydown.esc.stop="picker = null"
      >
        <CharacterSelectionPalette
          :characters="heroes"
          :pinned
          :enter-hint="i18n.t('app.import-pick-hero')"
          @pick="setPicked($event.id)"
        />
        <button v-if="pickerHasHero" type="button" class="remove-hero" @click="setPicked(null)">
          {{ i18n.t('app.import-remove-hero') }}
        </button>
      </SelectionPopup>
    </Teleport>
  </div>
</template>

<style scoped>
.review {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.side-head {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
  margin-bottom: var(--spacing-sm);
}

.side-label {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--import-label);
}

.side-player {
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--import-text);
}

.artifact {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  color: var(--import-text-dim);
}

.artifact-select {
  font: inherit;
  font-size: 0.78rem;
  max-width: 160px;
  padding: 4px 6px;
  border: 1px solid var(--import-border);
  border-radius: var(--radius-medium);
  background: var(--import-surface);
  color: var(--import-text);
  color-scheme: dark;
}

.artifact-select.review {
  border-color: var(--import-warn);
  background: var(--import-warn-tint);
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
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  padding: 6px;
  border: 1px solid var(--import-border);
  border-radius: var(--radius-large);
  background: var(--import-surface);
}

.cell.review {
  border-color: var(--import-warn);
  background: var(--import-warn-tint);
}

.cell.none {
  border-color: var(--import-bad);
  background: var(--import-bad-tint);
}

.cell-images {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
}

.cell-card,
.cell-portrait {
  display: block;
  width: 100%;
  aspect-ratio: 74 / 104;
  object-fit: cover;
  border-radius: var(--radius-medium);
  background: rgba(0, 0, 0, 0.35);
}

.cell-portrait.empty {
  background: rgba(255, 255, 255, 0.06);
}

.cell-name {
  width: 100%;
  padding: 4px 6px;
  border: 1px solid var(--import-border);
  border-radius: var(--radius-medium);
  background: var(--import-surface);
  color: var(--import-text);
  font: inherit;
  font-size: 0.78rem;
  font-weight: 600;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    color var(--transition-fast);
}

.cell-name:hover,
.cell-name:focus-visible,
.cell-name.open {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.cell-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  flex-wrap: wrap;
}

.cell-state {
  font-size: 0.66rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.cell-state.review {
  color: var(--import-warn);
}

.cell-state.none {
  color: var(--import-bad);
}

.cell-state.edited {
  color: var(--color-accent);
}

/* Rendered inside the teleported popup, hence the popup's own palette rather
   than the modal's --import-* tokens. */
.remove-hero {
  display: block;
  flex-shrink: 0;
  width: calc(100% - 8px);
  margin: 8px 4px 0;
  padding: 6px 0 0;
  border: none;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  background: none;
  color: rgba(255, 255, 255, 0.6);
  font: inherit;
  font-size: 11px;
  text-align: left;
  cursor: pointer;
}

.remove-hero:hover {
  color: #fff;
}
</style>
