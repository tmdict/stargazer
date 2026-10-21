<script setup lang="ts">
/* The review grid for one screenshot: its sides, five cells each, with the
   card as the reader located it, the hero it matched, the paragon /
   refinement pill, and a state: sure, review (amber), or not recognised
   (red). The name opens the grid's own character palette with the reader's
   candidates pinned first. Each side also shows its artifact, which opens the
   grid's artifact palette. A formation shot adds its units after them
   (TeamImportUnits).
   Every edit is an override on the shot; nothing here touches a board. */

import { computed, ref } from 'vue'

import ArtifactImage from '@/components/ArtifactImage.vue'
import ArtifactSelectionPalette from '@/components/ArtifactSelectionPalette.vue'
import CharacterSelectionPalette from '@/components/CharacterSelectionPalette.vue'
import ImportCellGrid from '@/components/import/ImportCellGrid.vue'
import ImportCellState from '@/components/import/ImportCellState.vue'
import ImportHeroCell from '@/components/import/ImportHeroCell.vue'
import ImportSideHead from '@/components/import/ImportSideHead.vue'
import TeamImportUnits, { type FormationUnits } from '@/components/teams/TeamImportUnits.vue'
import SelectionPopup from '@/components/ui/SelectionPopup.vue'
import type { ImportShot } from '@/composables/useTeamImport'
import { getOpposingTeam, isBaseHeroId } from '@/lib/characters/character'
import { compareFaction } from '@/lib/filterOrder'
import type { HeroReading } from '@/lib/import/card/types'
import type { CellState } from '@/lib/import/review'
import {
  artifactState,
  cellArtifactId,
  cellCharacterId,
  overrideKey,
  reviewStates,
  SIDES,
  type RecordNames,
} from '@/lib/teams/teamImport'
import type { ArtifactType } from '@/lib/types/artifact'
import type { CharacterType } from '@/lib/types/character'
import { Team, teamLabelKey } from '@/lib/types/team'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import { localizedDisplayName } from '@/utils/nameFormatting'

const {
  shot,
  names,
  swapSides,
  sides = SIDES,
  units,
} = defineProps<{
  shot: ImportShot
  names: RecordNames
  // The columns land on the opposite board sides; each head says which.
  swapSides: boolean
  // The sides to show: a formation shot has only its own team's cards, and
  // none to review when its board's result shot names the lineup.
  sides?: readonly Team[]
  units?: FormationUnits
}>()

const emit = defineEmits<{
  setHero: [id: string, team: Team, row: number, characterId: number | null]
  setLevel: [id: string, team: Team, row: number, field: 'paragon' | 'refinement', level: number]
  setArtifact: [id: string, team: Team, artifactId: number | null]
  setUnit: [id: string, index: number, unitId: number | null]
  setPick: [id: string, side: Team, hexId: number, unitId: number | null]
}>()

const gameData = useGameDataStore()
const i18n = useI18nStore()

const sideLabel = (team: Team): string => i18n.t(teamLabelKey(team))

const artifactName = (artifact: ArtifactType | null): string =>
  artifact ? localizedDisplayName(i18n.t, 'artifact', artifact.name) : i18n.t('app.import-none')

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
  const states = reviewStates(reading, team, shot.overrides)
  return reading.sides[team].map((cell, row) => {
    const key = overrideKey(team, row)
    const override = shot.overrides[key] ?? {}
    return {
      key,
      row,
      cell,
      characterId: cellCharacterId(reading, team, row, shot.overrides),
      paragon: override.paragon ?? cell.paragon.level,
      refinement: override.refinement ?? cell.refinement.level,
      state: states[row]!,
      edited: Object.keys(override).length > 0,
      card: shot.cards[key] ?? '',
    }
  })
}

const sideCells = computed(() => ({
  [Team.ALLY]: cells(Team.ALLY),
  [Team.ENEMY]: cells(Team.ENEMY),
}))

// ---------- hero picker ----------

// Every real hero in hero list order; a cell may take any of them, since the
// review is board-free and page-wide uniqueness is settled on Save as New.
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

const anchorBelow = (event: MouseEvent): { x: number; y: number } => {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  return { x: rect.left, y: rect.bottom + 4 }
}

const togglePicker = (team: Team, row: number, key: string, event: MouseEvent): void => {
  artifactPicker.value = null
  picker.value = picker.value?.key === key ? null : { team, row, key, position: anchorBelow(event) }
}

const pickerView = computed(() => {
  const target = picker.value
  return target ? (sideCells.value[target.team][target.row] ?? null) : null
})

const pinned = computed(() =>
  (pickerView.value?.cell.candidates ?? [])
    .map((c) => gameData.getCharacterById(c.characterId))
    .filter((c): c is CharacterType => c !== undefined),
)

const pickerHasHero = computed(
  () => pickerView.value !== null && pickerView.value.characterId !== null,
)

const setPicked = (characterId: number | null): void => {
  const target = picker.value
  if (!target) return
  emit('setHero', shot.id, target.team, target.row, characterId)
  picker.value = null
}

// ---------- artifacts ----------

interface ArtifactView {
  artifact: ArtifactType | null
  sure: boolean
  edited: boolean
}

const artifactView = (team: Team): ArtifactView => {
  const reading = shot.reading
  const id = reading ? cellArtifactId(reading, team, shot.artifactOverrides) : null
  const edited = shot.artifactOverrides[team] !== undefined
  return {
    artifact: id === null ? null : (gameData.getArtifactById(id) ?? null),
    sure: reading ? artifactState(reading, team, shot.artifactOverrides) === 'sure' : false,
    edited,
  }
}

const sideArtifacts = computed(() => ({
  [Team.ALLY]: artifactView(Team.ALLY),
  [Team.ENEMY]: artifactView(Team.ENEMY),
}))

// Pre-season first, then by id: the grid popup's order.
const artifacts = computed(() =>
  [...gameData.artifacts].sort((a, b) => a.season - b.season || a.id - b.id),
)

const artifactPicker = ref<{ team: Team; position: { x: number; y: number } } | null>(null)

const toggleArtifactPicker = (team: Team, event: MouseEvent): void => {
  picker.value = null
  artifactPicker.value =
    artifactPicker.value?.team === team ? null : { team, position: anchorBelow(event) }
}

const setArtifactPicked = (artifactId: number | null): void => {
  const target = artifactPicker.value
  if (!target) return
  emit('setArtifact', shot.id, target.team, artifactId)
  artifactPicker.value = null
}

const unitsSection = ref<InstanceType<typeof TeamImportUnits> | null>(null)

// The modal stops clicks before they reach the document, where the popup's
// own click-outside listens, so a tap elsewhere on the grid closes the
// pickers here (a mouse leaving the popup already does).
const closePickers = (event: MouseEvent): void => {
  unitsSection.value?.closeTilePicker()
  if ((event.target as HTMLElement).closest('.cell-name, .artifact-btn')) return
  picker.value = null
  artifactPicker.value = null
}
</script>

<template>
  <div class="review-grid" @click="closePickers">
    <div v-for="team in sides" :key="team" class="side">
      <ImportSideHead :label="sideLabel(team)">
        <template #default>
          <span class="side-player">{{ team === Team.ALLY ? names.left : names.right }}</span>
          <span v-if="swapSides" class="side-board">
            {{ i18n.t('app.import-board-side', { side: sideLabel(getOpposingTeam(team)) }) }}
          </span>
          <span class="artifact">
            <span class="artifact-label">{{ i18n.t('app.import-artifact') }}</span>
            <img
              v-if="shot.artifactCards[team]"
              class="artifact-card"
              :src="shot.artifactCards[team]"
              alt=""
            />
            <button
              type="button"
              class="artifact-btn"
              :class="{ unsure: !sideArtifacts[team].sure, open: artifactPicker?.team === team }"
              :title="artifactName(sideArtifacts[team].artifact)"
              @click="toggleArtifactPicker(team, $event)"
            >
              <span class="artifact-icon" :class="{ empty: sideArtifacts[team].artifact === null }">
                <ArtifactImage
                  v-if="sideArtifacts[team].artifact"
                  :artifact="sideArtifacts[team].artifact!"
                />
              </span>
              <span class="artifact-name">{{ artifactName(sideArtifacts[team].artifact) }}</span>
            </button>
            <ImportCellState
              v-if="!sideArtifacts[team].sure && sideArtifacts[team].artifact"
              state="review"
              :reading="artifactName(sideArtifacts[team].artifact)"
              :title="artifactName(sideArtifacts[team].artifact)"
              @confirm="emit('setArtifact', shot.id, team, sideArtifacts[team].artifact!.id)"
            />
            <ImportCellState v-else-if="!sideArtifacts[team].sure" state="review" />
            <ImportCellState v-else-if="sideArtifacts[team].edited" state="edited" />
          </span>
        </template>
      </ImportSideHead>
      <ImportCellGrid>
        <template #default>
          <ImportHeroCell
            v-for="view in sideCells[team]"
            :key="view.key"
            :card="view.card"
            :character-id="view.characterId"
            :paragon="view.paragon"
            :refinement="view.refinement"
            :state="view.state"
            :edited="view.edited"
            :open="picker?.key === view.key"
            @pick="togglePicker(team, view.row, view.key, $event)"
            @hero="emit('setHero', shot.id, team, view.row, $event)"
            @paragon="emit('setLevel', shot.id, team, view.row, 'paragon', $event)"
            @refinement="emit('setLevel', shot.id, team, view.row, 'refinement', $event)"
          />
        </template>
      </ImportCellGrid>
    </div>

    <TeamImportUnits
      v-if="units"
      ref="unitsSection"
      :shot
      :units
      @set-unit="(id, index, unitId) => emit('setUnit', id, index, unitId)"
      @set-pick="(id, side, hexId, unitId) => emit('setPick', id, side, hexId, unitId)"
    />

    <!-- Outside the modal's container, so their clicks and Escape are stopped
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
        <button v-if="pickerHasHero" type="button" class="picker-remove" @click="setPicked(null)">
          {{ i18n.t('app.remove-hero') }}
        </button>
      </SelectionPopup>
      <SelectionPopup
        v-if="artifactPicker"
        :position="artifactPicker.position"
        over-modal
        @close="artifactPicker = null"
        @click.stop
        @keydown.esc.stop="artifactPicker = null"
      >
        <ArtifactSelectionPalette :artifacts @pick="setArtifactPicked($event.id)" />
        <button
          v-if="sideArtifacts[artifactPicker.team].artifact !== null"
          type="button"
          class="picker-remove"
          @click="setArtifactPicked(null)"
        >
          {{ i18n.t('app.import-remove-artifact') }}
        </button>
      </SelectionPopup>
    </Teleport>
  </div>
</template>

<style scoped>
.review-grid {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.side-player {
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--import-text);
}

.side-board {
  padding: 1px 7px;
  border: 1px solid var(--color-accent);
  border-radius: 999px;
  color: var(--color-accent);
  font-size: 0.66rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.artifact {
  margin-left: auto;
  max-width: 100%;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 0.75rem;
  color: var(--import-text-dim);
}

.artifact-card {
  width: 52px;
  height: 52px;
  flex-shrink: 0;
  object-fit: cover;
  border-radius: var(--radius-medium);
}

.artifact-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 200px;
  min-width: 0;
  padding: 3px 8px 3px 3px;
  border: 1px solid var(--import-border);
  border-radius: 999px;
  background: var(--import-surface);
  color: var(--import-text);
  font: inherit;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    color var(--transition-fast);
}

.artifact-btn:hover,
.artifact-btn:focus-visible,
.artifact-btn.open {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.artifact-btn.unsure {
  border-color: var(--import-warn);
  background: var(--import-warn-tint);
}

.artifact-icon {
  position: relative;
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: hidden;
  background: #fff;
}

.artifact-icon.empty {
  background: rgba(255, 255, 255, 0.12);
}

.artifact-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Rendered inside the teleported popup, hence the popup's own palette rather
   than the modal's --import-* tokens. */
.picker-remove {
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

.picker-remove:hover {
  color: #fff;
}
</style>
