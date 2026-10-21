<script setup lang="ts">
/* A formation shot's units in its review grid: each portrait as the shot
   shows it, its tile, and the unit it is taken for, picked from the units its
   side can field, over two numbered boards, the screenshot's and the side as
   it will be placed, so a tile can be checked against both. The units it
   misses are listed after, each placed on one of the side's free tiles as on
   a replay frame (useTilePlacing).
   Every edit is an override on the shot; nothing here touches a board. */

import { computed, ref } from 'vue'

import TeamImportCell from '@/components/teams/TeamImportCell.vue'
import TeamImportCellGrid from '@/components/teams/TeamImportCellGrid.vue'
import TeamImportCellState from '@/components/teams/TeamImportCellState.vue'
import TeamImportNextBadge from '@/components/teams/TeamImportNextBadge.vue'
import TeamImportPlaceCount from '@/components/teams/TeamImportPlaceCount.vue'
import TeamImportPlaced from '@/components/teams/TeamImportPlaced.vue'
import TeamImportSideHead from '@/components/teams/TeamImportSideHead.vue'
import TeamImportTile, { tileOutline } from '@/components/teams/TeamImportTile.vue'
import TeamImportTileBox from '@/components/teams/TeamImportTileBox.vue'
import TeamImportTileMark, { ringWidth } from '@/components/teams/TeamImportTileMark.vue'
import TeamImportTileNumber from '@/components/teams/TeamImportTileNumber.vue'
import TeamImportTilePicker from '@/components/teams/TeamImportTilePicker.vue'
import DropdownSelect, { type DropdownItem } from '@/components/ui/DropdownSelect.vue'
import type { ImportShot } from '@/composables/useTeamImport'
import { useTilePlacing, type PlacingSide } from '@/composables/useTilePlacing'
import { useUnitLabels } from '@/composables/useUnitLabels'
import {
  BOARD_HEXES,
  hexCentre,
  hexCorners,
  RING_RADIUS,
  RING_RISE,
} from '@/lib/import/screens/formation/board'
import { isFormationReading } from '@/lib/import/screens/formation/types'
import { deploymentTiles } from '@/lib/maps'
import {
  assignedPortraits,
  missingUnits,
  portraitOptions,
  type UnitAssignment,
} from '@/lib/teams/formationImport'
import type { SideLoadBoard } from '@/lib/teams/sideLoad'
import { Team, teamLabelKey } from '@/lib/types/team'
import { useI18nStore } from '@/stores/i18n'

// Who each portrait is taken for, the units its side can field, and the side
// as the plan places it, on its map.
export interface FormationUnits {
  assignments: readonly UnitAssignment[]
  options: readonly number[]
  placed: { mapKey: string; team: Team; side: SideLoadBoard } | null
}

const { shot, units } = defineProps<{
  shot: ImportShot
  units: FormationUnits
}>()

const emit = defineEmits<{
  setUnit: [id: string, index: number, unitId: number | null]
  setPick: [id: string, side: Team, hexId: number, unitId: number | null]
}>()

const i18n = useI18nStore()
const { unitName, unitImage } = useUnitLabels()

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
  if (!reading || !isFormationReading(reading)) return []
  const assigned = units.assignments.map((assignment) => assignment.unitId)
  return units.assignments.map((assignment, index) => ({
    index,
    unitId: assignment.unitId,
    state: assignment.state,
    edited: shot.unitOverrides[index] !== undefined,
    tile: reading.units[index]?.hexId ?? 0,
    card: shot.unitCards[index] ?? '',
    items: [
      ...portraitOptions(units.options, assigned, index).map((id) => ({
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
  const widths = new Map(
    BOARD_HEXES.map((hex) => [hex.getId(), tileOutline(hexCorners(fit, hex)).width]),
  )
  return {
    viewBox: `${x} ${y} ${Math.max(...xs) + pad - x} ${Math.max(...ys) + pad - y}`,
    size: reading.size,
    numbers: BOARD_HEXES.map((hex) => ({
      hexId: hex.getId(),
      ...hexCentre(fit, hex),
      width: widths.get(hex.getId())!,
    })),
    rings: reading.units.map(({ ring, hexId }, index) => ({
      index,
      ...ring,
      width: widths.get(hexId)!,
      state: units.assignments[index]?.state ?? 'none',
    })),
  }
})

// A missing unit pointed at in its list, ringed on both boards too.
const pointedMissing = ref<number | null>(null)

const pointedUnit = computed(() => {
  const placed = units.placed
  const unitId =
    hovered.value === null
      ? pointedMissing.value
      : (units.assignments[hovered.value]?.unitId ?? null)
  return placed && unitId !== null ? { team: placed.team, unitId } : null
})

// ---------- units the screenshot misses ----------

// The board side the shot fills, its deployment tiles on the map its lit
// tiles name, and the tiles a portrait stands on.
const shotTiles = computed(() => {
  const placed = units.placed
  const reading = shot.reading
  if (!placed || !reading || !isFormationReading(reading)) return null
  return {
    team: placed.team,
    deploy: deploymentTiles(placed.mapKey, placed.team),
    shown: new Set(reading.units.map((u) => u.hexId)),
  }
})

const missing = computed((): PlacingSide | null => {
  const tiles = shotTiles.value
  const placed = units.placed
  const reading = shot.reading
  if (!placed || !tiles || !reading || !isFormationReading(reading)) return null
  const portraits = assignedPortraits(reading.units, units.assignments)
  const lineup = placed.side.mains.map((unit) => unit.unitId)
  const side = missingUnits(lineup, portraits, units.options, shot.tilePicks[tiles.team] ?? {})
  if (side.order.length === 0 && side.picks.size === 0) return null
  const heroes = lineup.filter((unitId) => !portraits.some((u) => u.unitId === unitId))
  return { ...side, heroes }
})

const {
  nextUnits,
  choose,
  clickTile,
  hovered: hoveredTile,
  preview,
  picker: tilePicker,
  pickerItems,
  pickedHere,
  pick: pickTile,
  rows,
  typeError,
  typeTile,
  typeTileAndNext,
} = useTilePlacing({
  sides: () => (missing.value && shotTiles.value ? { [shotTiles.value.team]: missing.value } : {}),
  refusal: (side, hexId, text) => {
    if (!shotTiles.value?.deploy.has(hexId)) {
      return i18n.t('app.import-tile-refused', { tile: text, side: i18n.t(teamLabelKey(side)) })
    }
    return shotTiles.value.shown.has(hexId) ? i18n.t('app.import-tile-taken', { tile: text }) : null
  },
  setPick: (side, hexId, unitId) => emit('setPick', shot.id, side, hexId, unitId),
})

// The review grid closes the picker on a click anywhere in it, the hero cells included.
defineExpose({
  closeTilePicker: (): void => {
    tilePicker.value = null
  },
})

const shotTeam = computed(() => shotTiles.value?.team ?? null)
const sideClass = computed(() => (shotTeam.value === Team.ALLY ? 'ally' : 'enemy'))
const missingRows = computed(() => (shotTeam.value === null ? [] : rows(shotTeam.value)))

// The side's units on a tile, of every unit it fields: the portraits' and the missing ones.
const placeCount = computed(() => {
  const shown = unitViews.value.filter((view) => view.unitId !== null).length
  return {
    placed: shown + missingRows.value.filter((row) => row.tile !== null).length,
    total: shown + missingRows.value.length,
  }
})

const pickTiles = computed(() => {
  const placing = missing.value
  const tiles = shotTiles.value
  const reading = shot.reading
  if (!placing || !tiles || !reading || !isFormationReading(reading) || !reading.board) return []
  const fit = reading.board
  return BOARD_HEXES.filter(
    (hex) => tiles.deploy.has(hex.getId()) && !tiles.shown.has(hex.getId()),
  ).map((hex) => ({
    hexId: hex.getId(),
    side: tiles.team,
    ...tileOutline(hexCorners(fit, hex)),
    ...hexCentre(fit, hex),
    unitId: placing.picks.get(hex.getId()) ?? null,
  }))
})

// A picked unit's portrait, drawn where and as large as the screenshot draws
// its own: the portraits' mean size and offset from their tile's centre, or
// where the reader looks for a portrait when it found none.
const mark = computed(() => {
  const reading = shot.reading
  if (!reading || !isFormationReading(reading) || !reading.board) return { radius: 0, dx: 0, dy: 0 }
  const fit = reading.board
  const offsets = reading.units.flatMap(({ hexId, ring }) => {
    const hex = BOARD_HEXES.find((h) => h.getId() === hexId)
    if (!hex) return []
    const centre = hexCentre(fit, hex)
    return [{ radius: ring.radius, dx: ring.x - centre.x, dy: ring.y - centre.y }]
  })
  if (offsets.length === 0)
    return { radius: RING_RADIUS * fit.scale, dx: 0, dy: -RING_RISE * fit.scale }
  const mean = (key: 'radius' | 'dx' | 'dy'): number =>
    offsets.reduce((sum, o) => sum + o[key], 0) / offsets.length
  return { radius: mean('radius'), dx: mean('dx'), dy: mean('dy') }
})

const previewMark = computed(() => {
  const shown = preview.value
  const tile = shown ? pickTiles.value.find((t) => t.hexId === shown.hexId) : undefined
  return shown && tile ? { ...tile, unitId: shown.unitId } : null
})

const boardFrame = ref<HTMLElement>()

// The picker sits under the tile clicked, measured on screen, since the
// board may be drawn smaller than its box.
const clickShotTile = (hexId: number, event: Event): void => {
  const frame = boardFrame.value?.getBoundingClientRect()
  const team = shotTeam.value
  if (!frame || team === null) return
  const tile = (event.currentTarget as Element).getBoundingClientRect()
  clickTile({
    hexId,
    side: team,
    left: (tile.left + tile.width / 2 - frame.left) / frame.width,
    top: (tile.top + tile.height / 2 - frame.top) / frame.height,
  })
}

const sectionEl = ref<HTMLElement>()
const tileBoxes = (): HTMLInputElement[] => [
  ...(sectionEl.value?.querySelectorAll<HTMLInputElement>('.tile-box') ?? []),
]
</script>

<template>
  <div v-if="unitViews.length || missingRows.length" ref="sectionEl" class="side">
    <TeamImportSideHead :label="i18n.t('app.import-units')">
      <template #default>
        <TeamImportPlaceCount v-if="missingRows.length" v-bind="placeCount" />
      </template>
    </TeamImportSideHead>
    <div class="boards">
      <figure v-if="shotBoard" class="board">
        <div ref="boardFrame" class="board-frame">
          <svg class="board-view" :viewBox="shotBoard.viewBox">
            <image
              :href="shot.thumb"
              x="0"
              y="0"
              :width="shotBoard.size.width"
              :height="shotBoard.size.height"
            />
            <TeamImportTile
              v-for="tile in pickTiles"
              :key="`pick-${tile.hexId}`"
              :points="tile.points"
              :tile-width="tile.width"
              :side="tile.side"
              :active="tilePicker?.hexId === tile.hexId"
              role="button"
              tabindex="0"
              :aria-label="i18n.t('app.import-tile', { tile: tile.hexId })"
              @click.stop="clickShotTile(tile.hexId, $event)"
              @keydown.enter.prevent="clickShotTile(tile.hexId, $event)"
              @mouseenter="hoveredTile = { side: tile.side, hexId: tile.hexId }"
              @mouseleave="hoveredTile = null"
            />
            <circle
              v-for="ring in shotBoard.rings"
              :key="`ring-${ring.index}`"
              class="shot-ring"
              :class="[ring.state, { pointed: hovered === ring.index }]"
              :cx="ring.x"
              :cy="ring.y"
              :r="ring.radius"
              :stroke-width="ringWidth(ring.width, hovered === ring.index)"
            />
            <template v-for="tile in pickTiles" :key="`mark-${tile.hexId}`">
              <TeamImportTileMark
                v-if="tile.unitId !== null"
                :x="tile.x + mark.dx"
                :y="tile.y + mark.dy"
                :radius="mark.radius"
                :tile-width="tile.width"
                :href="unitImage(tile.unitId)"
                :pointed="pointedMissing === tile.unitId"
              />
            </template>
            <TeamImportTileMark
              v-if="previewMark"
              preview
              :x="previewMark.x + mark.dx"
              :y="previewMark.y + mark.dy"
              :radius="mark.radius"
              :tile-width="previewMark.width"
              :href="unitImage(previewMark.unitId)"
            />
            <TeamImportTileNumber
              v-for="n in shotBoard.numbers"
              :key="`n-${n.hexId}`"
              :x="n.x"
              :y="n.y"
              :tile-width="n.width"
              :hex-id="n.hexId"
            />
          </svg>
          <TeamImportTilePicker
            v-if="tilePicker"
            :picker="tilePicker"
            :items="pickerItems"
            :picked-here
            @pick="pickTile"
          />
        </div>
        <figcaption>{{ i18n.t('app.import-in-screenshot') }}</figcaption>
      </figure>
      <TeamImportPlaced
        v-if="units.placed"
        :map-key="units.placed.mapKey"
        :sides="{ [units.placed.team]: units.placed.side }"
        :pointed="pointedUnit"
      />
    </div>
    <p v-if="missingRows.length" class="units-note">{{ i18n.t('app.import-place-missing') }}</p>
    <TeamImportCellGrid :class="sideClass">
      <template #default>
        <TeamImportCell
          v-for="view in unitViews"
          :key="view.index"
          class="unit"
          :class="view.state"
          :card="view.card"
          :portrait="view.unitId === null ? null : unitImage(view.unitId)"
          @mouseenter="hovered = view.index"
          @mouseleave="hovered = null"
          @focusin="hovered = view.index"
          @focusout="hovered = null"
        >
          <template #name>
            <DropdownSelect
              :label="unitName(view.unitId)"
              :items="view.items"
              variant="dark"
              floating
              click-only
              class="unit-pick"
              @select="pickUnit(view.index, $event)"
            />
          </template>
          <template #meta>
            <span class="unit-tile">{{ i18n.t('app.import-tile', { tile: view.tile }) }}</span>
            <TeamImportCellState
              v-if="view.state === 'review' && view.unitId !== null"
              state="review"
              :reading="unitName(view.unitId)"
              :title="unitName(view.unitId)"
              @confirm="emit('setUnit', shot.id, view.index, view.unitId)"
            />
            <TeamImportCellState v-else-if="view.state === 'none'" state="none" />
            <TeamImportCellState v-else-if="view.edited" state="edited" />
          </template>
        </TeamImportCell>
        <template v-if="shotTeam !== null">
          <TeamImportCell
            v-for="row in missingRows"
            :key="row.unitId"
            class="unit missing"
            :class="{ next: nextUnits[shotTeam] === row.unitId, unplaced: row.tile === null }"
            card=""
            :portrait="unitImage(row.unitId)"
            @mouseenter="pointedMissing = row.unitId"
            @mouseleave="pointedMissing = null"
          >
            <template #name>
              <button
                type="button"
                class="cell-name"
                :aria-pressed="nextUnits[shotTeam] === row.unitId"
                :title="unitName(row.unitId)"
                @click="choose(shotTeam, row.unitId)"
              >
                {{ unitName(row.unitId) }}
              </button>
            </template>
            <template #meta>
              <TeamImportTileBox
                :tile="row.tile"
                :label="i18n.t('app.import-tile-for', { name: unitName(row.unitId) })"
                @focus="pointedMissing = row.unitId"
                @blur="pointedMissing = null"
                @change="typeTile(shotTeam, row.unitId, $event.target as HTMLInputElement)"
                @keydown.enter.prevent="typeTileAndNext(shotTeam, row.unitId, $event, tileBoxes())"
              />
              <TeamImportNextBadge v-if="nextUnits[shotTeam] === row.unitId" :side="shotTeam" />
            </template>
          </TeamImportCell>
        </template>
      </template>
    </TeamImportCellGrid>
    <p v-if="typeError" class="type-error" role="alert">{{ typeError }}</p>
  </div>
</template>

<style scoped>
.side-head > .place-count {
  margin-left: auto;
}

.unit-pick {
  --dropdown-trigger-width: 100%;
}

.boards {
  --placed-max-height: 380px;
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
  max-height: var(--placed-max-height);
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

.board-frame {
  position: relative;
}

.cells.ally {
  --pick-colour: var(--import-ally);
}

.cells.enemy {
  --pick-colour: var(--import-enemy);
}

.units-note {
  margin: var(--spacing-sm) 0;
  font-size: 0.78rem;
  color: var(--import-text-dim);
}

.type-error {
  margin: var(--spacing-sm) 0 0;
  font-size: 0.75rem;
  color: var(--import-bad);
}

.unit-tile {
  font-size: 0.72rem;
  color: var(--import-text-dim);
}
</style>
