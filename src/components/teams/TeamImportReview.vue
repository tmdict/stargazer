<script setup lang="ts">
/* The review grid for one screenshot: its sides, five cells each, with the
   card as the reader located it, the hero it matched, the paragon /
   refinement pill, and a state: sure, review (amber), or not recognised
   (red). The name opens the grid's own character palette with the reader's
   candidates pinned first. Each side also shows its artifact, which opens the
   grid's artifact palette. A formation shot adds its units: each portrait as
   the shot shows it, its tile, and the unit it is taken for, picked from the
   units its side can field, over two numbered boards, the screenshot's and
   the side as it will be placed, so a tile can be checked against both.
   Every edit is an override on the shot; nothing here touches a board. */

import { computed, ref } from 'vue'

import ArtifactImage from '@/components/ArtifactImage.vue'
import ArtifactSelectionPalette from '@/components/ArtifactSelectionPalette.vue'
import CharacterSelectionPalette from '@/components/CharacterSelectionPalette.vue'
import BoardThumbnail, { type ThumbnailUnit } from '@/components/grid/BoardThumbnail.vue'
import DropdownSelect, { type DropdownItem } from '@/components/ui/DropdownSelect.vue'
import SelectionPopup from '@/components/ui/SelectionPopup.vue'
import UpgradePill from '@/components/ui/UpgradePill.vue'
import type { ImportShot } from '@/composables/useTeamImport'
import { useUnitLabels } from '@/composables/useUnitLabels'
import { getOpposingTeam, isBaseHeroId } from '@/lib/characters/character'
import { compareFaction } from '@/lib/filterOrder'
import { BOARD_HEXES, hexCentre, hexCorners } from '@/lib/import/board'
import type { HeroReading } from '@/lib/import/types'
import { isFormationReading } from '@/lib/import/types'
import type { UnitAssignment } from '@/lib/teams/formationImport'
import type { SideLoadBoard } from '@/lib/teams/sideLoad'
import {
  artifactState,
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
  // A formation shot's units: who each portrait is taken for, the units its
  // side can field, and the side as the plan places it, on its map.
  units?: {
    assignments: readonly UnitAssignment[]
    options: readonly number[]
    placed: { mapKey: string; team: Team; side: SideLoadBoard } | null
  }
}>()

const emit = defineEmits<{
  setHero: [id: string, team: Team, row: number, characterId: number | null]
  setLevel: [id: string, team: Team, row: number, field: 'paragon' | 'refinement', level: number]
  setArtifact: [id: string, team: Team, artifactId: number | null]
  setUnit: [id: string, index: number, unitId: number | null]
}>()

const gameData = useGameDataStore()
const i18n = useI18nStore()

const sideLabel = (team: Team): string => i18n.t(teamLabelKey(team))

const { heroName, heroImage, unitName, unitImage } = useUnitLabels()

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

// The modal stops clicks before they reach the document, where the popup's
// own click-outside listens, so a tap elsewhere on the grid closes the
// pickers here (a mouse leaving the popup already does).
const closePickers = (event: MouseEvent): void => {
  if ((event.target as HTMLElement).closest('.cell-name, .artifact-btn')) return
  picker.value = null
  artifactPicker.value = null
}

// ---------- units ----------

interface UnitView {
  index: number
  unitId: number | null
  state: UnitAssignment['state']
  edited: boolean
  tile: number
  card: string
  items: DropdownItem[]
}

const unitViews = computed((): UnitView[] => {
  const reading = shot.reading
  if (!units || !reading || !isFormationReading(reading)) return []
  return units.assignments.map((assignment, index) => ({
    index,
    unitId: assignment.unitId,
    state: assignment.state,
    edited: shot.unitOverrides[index] !== undefined,
    tile: reading.units[index]?.hexId ?? 0,
    card: shot.unitCards[index] ?? '',
    items: [
      ...units.options.map((id) => ({
        key: String(id),
        label: unitName(id),
        selected: id === assignment.unitId,
      })),
      { key: 'none', label: i18n.t('app.import-none'), selected: assignment.unitId === null },
    ],
  }))
})

const pickUnit = (index: number, key: string): void => {
  emit('setUnit', shot.id, index, key === 'none' ? null : Number(key))
}

// The unit pointed at in the list, ringed on both boards.
const hovered = ref<number | null>(null)

// The screenshot's board with its portraits, in the read image's pixels: the
// screenshot fills that box, so the board fit places tile numbers and rings on it.
const shotBoard = computed(() => {
  const reading = shot.reading
  if (!reading || !isFormationReading(reading) || !reading.board) return null
  const fit = reading.board
  const xs: number[] = []
  const ys: number[] = []
  for (const hex of BOARD_HEXES) {
    for (const corner of hexCorners(fit, hex)) {
      xs.push(corner.x)
      ys.push(corner.y)
    }
  }
  for (const { ring } of reading.units) ys.push(ring.y - ring.radius)
  const pad = fit.scale * 0.3
  const x = Math.min(...xs) - pad
  const y = Math.min(...ys) - pad
  return {
    viewBox: `${x} ${y} ${Math.max(...xs) + pad - x} ${Math.max(...ys) + pad - y}`,
    size: reading.size,
    scale: fit.scale,
    numbers: BOARD_HEXES.map((hex) => ({ hexId: hex.getId(), ...hexCentre(fit, hex) })),
    rings: reading.units.map(({ ring }, index) => ({
      index,
      ...ring,
      state: units?.assignments[index]?.state ?? 'none',
    })),
  }
})

const placedUnits = computed((): ThumbnailUnit[] => {
  const placed = units?.placed
  if (!placed) return []
  const { side, team } = placed
  const pointed = hovered.value === null ? null : units.assignments[hovered.value]?.unitId
  return [...side.mains, ...side.companions, ...(side.phantimal ? [side.phantimal] : [])].flatMap(
    ({ unitId, hexId }) =>
      hexId === undefined
        ? []
        : [
            {
              hexId,
              team,
              image: unitImage(unitId),
              title: unitName(unitId),
              highlight: unitId === pointed,
            },
          ],
  )
})

const STATE_LABEL: Record<Exclude<CellState, 'sure' | 'paragon' | 'refinement'>, string> = {
  review: 'app.import-review',
  none: 'app.import-unrecognised',
  duplicate: 'app.picked-twice',
}
</script>

<template>
  <div class="review-grid" @click="closePickers">
    <div v-for="team in sides" :key="team" class="side">
      <div class="side-head">
        <span class="side-label">{{ sideLabel(team) }}</span>
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
            <button
              v-else-if="view.state === 'refinement'"
              type="button"
              class="cell-state review confirm-choice confirm-refinement"
              @click="emit('setLevel', shot.id, team, view.row, 'refinement', view.refinement)"
            >
              {{ i18n.t('app.import-confirm', { value: `R${view.refinement}` }) }}
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

    <div v-if="unitViews.length" class="side">
      <div class="side-head">
        <span class="side-label">{{ i18n.t('app.import-units') }}</span>
      </div>
      <div class="boards">
        <figure v-if="shotBoard" class="board">
          <svg class="board-view" :viewBox="shotBoard.viewBox">
            <image
              :href="shot.thumb"
              x="0"
              y="0"
              :width="shotBoard.size.width"
              :height="shotBoard.size.height"
            />
            <circle
              v-for="ring in shotBoard.rings"
              :key="`ring-${ring.index}`"
              class="shot-ring"
              :class="[ring.state, { pointed: hovered === ring.index }]"
              :cx="ring.x"
              :cy="ring.y"
              :r="ring.radius"
              :stroke-width="shotBoard.scale * (hovered === ring.index ? 0.14 : 0.06)"
            />
            <text
              v-for="n in shotBoard.numbers"
              :key="`n-${n.hexId}`"
              class="shot-number"
              :x="n.x"
              :y="n.y"
              :font-size="shotBoard.scale * 0.42"
              :stroke-width="shotBoard.scale * 0.12"
              text-anchor="middle"
              dominant-baseline="central"
            >
              {{ n.hexId }}
            </text>
          </svg>
          <figcaption>{{ i18n.t('app.import-in-screenshot') }}</figcaption>
        </figure>
        <figure v-if="units?.placed" class="board">
          <BoardThumbnail
            class="board-view"
            :map-key="units.placed.mapKey"
            :units="placedUnits"
            :hex-size="16"
            crisp
            numbered
          />
          <figcaption>{{ i18n.t('app.import-on-board') }}</figcaption>
        </figure>
      </div>
      <div class="cells">
        <div
          v-for="view in unitViews"
          :key="view.index"
          class="cell unit"
          :class="view.state"
          @mouseenter="hovered = view.index"
          @mouseleave="hovered = null"
          @focusin="hovered = view.index"
          @focusout="hovered = null"
        >
          <div class="cell-images">
            <img v-if="view.card" class="cell-card" :src="view.card" alt="" />
            <img
              v-if="view.unitId !== null"
              class="cell-portrait"
              :src="unitImage(view.unitId)"
              alt=""
            />
            <span v-else class="cell-portrait empty" />
          </div>
          <DropdownSelect
            :label="unitName(view.unitId)"
            :items="view.items"
            variant="dark"
            floating
            click-only
            class="unit-pick"
            @select="pickUnit(view.index, $event)"
          />
          <div class="cell-meta">
            <span class="unit-tile">{{ i18n.t('app.import-tile', { tile: view.tile }) }}</span>
            <button
              v-if="view.state === 'review' && view.unitId !== null"
              type="button"
              class="cell-state review confirm-choice"
              :title="unitName(view.unitId)"
              @click="emit('setUnit', shot.id, view.index, view.unitId)"
            >
              {{ i18n.t('app.import-confirm', { value: unitName(view.unitId) }) }}
            </button>
            <span v-else-if="view.state === 'none'" class="cell-state none">
              {{ i18n.t('app.import-unrecognised') }}
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

/* The grid's round white-backed icon, at chip size. */
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
.cell.paragon,
.cell.refinement {
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

/* A unit's portraits are round in game, so both crops are square, from the top
   of the art like the board's own portraits. */
.cell.unit .cell-card,
.cell.unit .cell-portrait {
  aspect-ratio: 1;
  object-position: top;
}

.unit-pick {
  --dropdown-trigger-width: 100%;
}

.boards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-sm);
}

.board {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  min-width: 0;
}

.board figcaption {
  font-size: 0.72rem;
  color: var(--import-text-dim);
}

.board-view {
  display: block;
  width: 100%;
  height: auto;
  max-height: 380px;
  border-radius: var(--radius-medium);
  background: rgba(0, 0, 0, 0.35);
}

.shot-ring {
  fill: none;
  stroke: var(--color-accent);
}

.shot-ring.review {
  stroke: var(--import-warn);
}

.shot-ring.none {
  stroke: var(--import-bad);
}

.shot-number {
  fill: #fff;
  stroke: rgba(0, 0, 0, 0.75);
  paint-order: stroke;
  font-family: sans-serif;
  font-weight: 700;
  pointer-events: none;
}

.unit-tile {
  font-size: 0.72rem;
  color: var(--import-text-dim);
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
