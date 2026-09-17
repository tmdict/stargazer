<script setup lang="ts">
/* The review grid for one screenshot: both sides, five cells each, with the
   card as the reader located it, the hero it matched, the paragon /
   refinement pill, and a state: sure, review (amber), or not recognised
   (red). The name opens the grid's own character palette with the reader's
   candidates pinned first. Each side also shows its artifact, which opens the
   grid's artifact palette. Every edit is an override on the shot; nothing
   here touches a board. */

import { computed, ref } from 'vue'

import ArtifactImage from '@/components/ArtifactImage.vue'
import ArtifactSelectionPalette from '@/components/ArtifactSelectionPalette.vue'
import CharacterSelectionPalette from '@/components/CharacterSelectionPalette.vue'
import SelectionPopup from '@/components/ui/SelectionPopup.vue'
import UpgradePill from '@/components/ui/UpgradePill.vue'
import type { ImportShot } from '@/composables/useTeamImport'
import { getOpposingTeam, isBaseHeroId } from '@/lib/characters/character'
import { compareFaction } from '@/lib/filterOrder'
import type { HeroReading } from '@/lib/import/types'
import {
  cellArtifactId,
  cellCharacterId,
  overrideKey,
  reviewStates,
  SIDES,
  type CellState,
  type RecordNames,
} from '@/lib/teams/teamImport'
import type { ArtifactType } from '@/lib/types/artifact'
import type { CharacterType } from '@/lib/types/character'
import { Team } from '@/lib/types/team'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import { localizedDisplayName } from '@/utils/nameFormatting'

const { shot, names, swapSides } = defineProps<{
  shot: ImportShot
  names: RecordNames
  // The columns land on the opposite board sides; each head says which.
  swapSides: boolean
}>()

const emit = defineEmits<{
  setHero: [id: string, team: Team, row: number, characterId: number | null]
  setLevel: [id: string, team: Team, row: number, field: 'paragon' | 'refinement', level: number]
  setArtifact: [id: string, team: Team, artifactId: number | null]
}>()

const gameData = useGameDataStore()
const i18n = useI18nStore()

const sideLabel = (team: Team): string => i18n.t(team === Team.ALLY ? 'app.ally' : 'app.enemy')

const heroName = (characterId: number | null): string => {
  if (characterId === null) return i18n.t('app.import-none')
  const slug = gameData.getCharacterNameById(characterId)
  return slug ? localizedDisplayName(i18n.t, 'character', slug) : String(characterId)
}

const heroImage = (characterId: number | null): string => {
  const slug = characterId === null ? undefined : gameData.getCharacterNameById(characterId)
  return slug ? gameData.getCharacterImage(slug) : ''
}

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

// Every real hero in roster order; a cell may take any of them, since the
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
    sure: edited || (reading?.artifacts[team]?.margin ?? 0) >= 0.1,
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

// The modal stops clicks before they reach the document, where the popup's
// own click-outside listens, so a tap elsewhere on the grid closes the
// pickers here (a mouse leaving the popup already does).
const closePickers = (event: MouseEvent): void => {
  if ((event.target as HTMLElement).closest('.cell-name, .artifact-btn')) return
  picker.value = null
  artifactPicker.value = null
}

const STATE_LABEL: Record<Exclude<CellState, 'sure' | 'paragon'>, string> = {
  review: 'app.import-review',
  none: 'app.import-unrecognised',
  duplicate: 'app.picked-twice',
}
</script>

<template>
  <div class="review-grid" @click="closePickers">
    <div v-for="team in SIDES" :key="team" class="side">
      <div class="side-head">
        <span class="side-label">{{ sideLabel(team) }}</span>
        <span class="side-player">{{ team === Team.ALLY ? names.left : names.right }}</span>
        <span v-if="swapSides" class="side-board">
          {{ i18n.t('app.import-board-side', { side: sideLabel(getOpposingTeam(team)) }) }}
        </span>
        <span class="artifact">
          <span class="artifact-label">{{ i18n.t('app.import-artifact') }}</span>
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
          <button
            v-if="!sideArtifacts[team].sure && sideArtifacts[team].artifact"
            type="button"
            class="cell-state review confirm-choice confirm-artifact"
            :title="artifactName(sideArtifacts[team].artifact)"
            @click="emit('setArtifact', shot.id, team, sideArtifacts[team].artifact!.id)"
          >
            {{
              i18n.t('app.import-confirm', { value: artifactName(sideArtifacts[team].artifact) })
            }}
          </button>
          <span v-else-if="!sideArtifacts[team].sure" class="cell-state review">
            {{ i18n.t('app.import-review') }}
          </span>
          <span v-else-if="sideArtifacts[team].edited" class="cell-state edited">
            {{ i18n.t('app.import-edited') }}
          </span>
        </span>
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
              @paragon="emit('setLevel', shot.id, team, view.row, 'paragon', $event)"
              @refinement="emit('setLevel', shot.id, team, view.row, 'refinement', $event)"
            />
            <button
              v-if="view.state === 'review' && view.characterId !== null"
              type="button"
              class="cell-state review confirm-choice confirm-hero"
              :title="heroName(view.characterId)"
              @click="emit('setHero', shot.id, team, view.row, view.characterId)"
            >
              {{ i18n.t('app.import-confirm', { value: heroName(view.characterId) }) }}
            </button>
            <button
              v-else-if="view.state === 'paragon'"
              type="button"
              class="cell-state review confirm-choice confirm-paragon"
              @click="emit('setLevel', shot.id, team, view.row, 'paragon', view.paragon)"
            >
              {{ i18n.t('app.import-confirm', { value: `P${view.paragon}` }) }}
            </button>
            <span v-else-if="view.state !== 'sure'" class="cell-state" :class="view.state">
              {{ i18n.t(STATE_LABEL[view.state]) }}
            </span>
            <span v-else-if="view.edited" class="cell-state edited">{{
              i18n.t('app.import-edited')
            }}</span>
          </div>
        </div>
      </div>
    </div>

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
  font-size: 0.75rem;
  color: var(--import-text-dim);
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

/* The grid's round white-backed icon, at chip size. */
.artifact-icon {
  position: relative;
  flex-shrink: 0;
  width: 26px;
  height: 26px;
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

.cell.review,
.cell.paragon {
  border-color: var(--import-warn);
  background: var(--import-warn-tint);
}

.cell.none,
.cell.duplicate {
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

.confirm-choice {
  max-width: 100%;
  padding: 4px 6px;
  border: 1px solid currentColor;
  border-radius: var(--radius-medium);
  background: transparent;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.confirm-choice:hover,
.confirm-choice:focus-visible {
  background: var(--import-warn-tint);
}

.cell-state.none,
.cell-state.duplicate {
  color: var(--import-bad);
}

.cell-state.edited {
  color: var(--color-accent);
}

@media (pointer: coarse) {
  .confirm-choice {
    min-height: 32px;
  }

  .cell-name {
    padding: 8px 6px;
  }
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
