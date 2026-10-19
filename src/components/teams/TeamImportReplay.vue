<script setup lang="ts">
/* A replay frame's review: Stargazer's board drawn where the battle camera
   puts it on the paused frame, every tile numbered, each team's deployment
   tiles tinted and the blocked ones hatched (they should sit on the walls).
   Tapping a deployment tile picks which of that team's units started there,
   from the lineup the map's result screenshot named; the lists beside it say
   where each hero was placed. Heroes may have moved before the pause, so the
   tile is the reviewer's call. Every pick is an edit on the shot; nothing
   here touches a board. */

import { computed, ref } from 'vue'

import type { ImportShot } from '@/composables/useTeamImport'
import { useUnitLabels } from '@/composables/useUnitLabels'
import { getOpposingTeam } from '@/lib/characters/character'
import { BOARD_HEXES } from '@/lib/import/board'
import { replayHexCentre, replayHexCorners } from '@/lib/import/replay'
import { isReplayReading } from '@/lib/import/types'
import { MAPS } from '@/lib/maps'
import { SIDES } from '@/lib/teams/teamImport'
import { State } from '@/lib/types/state'
import { Team, teamLabelKey } from '@/lib/types/team'
import { useI18nStore } from '@/stores/i18n'

const { shot, mapKey, columns, swapSides } = defineProps<{
  shot: ImportShot
  // The map the frame's board stands on; null while the frame has no board.
  mapKey: string | null
  // Per screenshot column: its lineup's heroes, and every unit it can field.
  columns: Record<Team, { heroes: readonly number[]; options: readonly number[] }>
  // The columns land on the opposite board sides; each head says which.
  swapSides: boolean
}>()

const emit = defineEmits<{
  setPick: [id: string, column: Team, hexId: number, unitId: number | null]
}>()

const i18n = useI18nStore()
const { unitName, unitImage } = useUnitLabels()

type TileKind = 'ally' | 'enemy' | 'blocked' | 'neutral'

// A team's deployment tiles are its column's: the game draws the viewing
// player, the Ally column, on the ally tiles.
const KIND_COLUMN: Partial<Record<TileKind, Team>> = { ally: Team.ALLY, enemy: Team.ENEMY }

const tileKinds = computed(() => {
  const kinds = new Map<number, TileKind>()
  for (const { type, hex } of (mapKey ? MAPS[mapKey]?.grid : undefined) ?? []) {
    const kind: TileKind | null =
      type === State.AVAILABLE_ALLY
        ? 'ally'
        : type === State.AVAILABLE_ENEMY
          ? 'enemy'
          : type === State.BLOCKED || type === State.BLOCKED_BREAKABLE
            ? 'blocked'
            : null
    if (kind) for (const id of hex) kinds.set(id, kind)
  }
  return kinds
})

interface TileView {
  id: number
  points: string
  x: number
  y: number
  // Across the tile, in frame pixels: far rows are drawn smaller.
  width: number
  kind: TileKind
  column: Team | null
  unitId: number | null
}

const view = computed(() => {
  const reading = shot.reading
  if (!reading || !isReplayReading(reading) || !reading.placement) return null
  const placement = reading.placement
  const tiles: TileView[] = BOARD_HEXES.map((hex) => {
    const id = hex.getId()
    const corners = replayHexCorners(placement, hex)
    const centre = replayHexCentre(placement, hex)
    const xs = corners.map((c) => c.x)
    const kind = tileKinds.value.get(id) ?? 'neutral'
    const column = KIND_COLUMN[kind] ?? null
    return {
      id,
      points: corners.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' '),
      x: centre.x,
      y: centre.y,
      width: Math.max(...xs) - Math.min(...xs),
      kind,
      column,
      unitId: column === null ? null : (shot.tilePicks[column]?.[id] ?? null),
    }
  })
  // The board with room above it for the units standing on the far rows.
  const corners = BOARD_HEXES.flatMap((hex) => replayHexCorners(placement, hex))
  const tile = Math.max(...tiles.map((t) => t.width))
  const { width, height } = reading.size
  const x0 = Math.max(0, Math.min(...corners.map((c) => c.x)) - tile * 0.5)
  const y0 = Math.max(0, Math.min(...corners.map((c) => c.y)) - tile * 1.6)
  const x1 = Math.min(width, Math.max(...corners.map((c) => c.x)) + tile * 0.5)
  const y1 = Math.min(height, Math.max(...corners.map((c) => c.y)) + tile * 0.4)
  return { box: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, width, height, tiles }
})

const tileOf = (column: Team, unitId: number): number | null => {
  const entry = Object.entries(shot.tilePicks[column] ?? {}).find(([, id]) => id === unitId)
  return entry ? Number(entry[0]) : null
}

// ---------- picking ----------

interface Picker {
  hexId: number
  column: Team
  // Where the tile is, as a fraction of the drawn frame.
  left: number
  top: number
}

const picker = ref<Picker | null>(null)

const openPicker = (tile: TileView): void => {
  const box = view.value?.box
  if (tile.column === null || !box) return
  picker.value =
    picker.value?.hexId === tile.id
      ? null
      : {
          hexId: tile.id,
          column: tile.column,
          left: (tile.x - box.x) / box.w,
          top: (tile.y - box.y) / box.h,
        }
}

const pickerItems = computed(() => {
  const target = picker.value
  if (!target) return []
  return columns[target.column].options.map((unitId) => ({
    unitId,
    tile: tileOf(target.column, unitId),
  }))
})

const pickedHere = computed(() => {
  const target = picker.value
  return target ? (shot.tilePicks[target.column]?.[target.hexId] ?? null) : null
})

const pick = (unitId: number | null): void => {
  const target = picker.value
  if (!target) return
  emit('setPick', shot.id, target.column, target.hexId, unitId)
  picker.value = null
}

// ---------- lineups ----------

const lineups = computed(() =>
  SIDES.map((column) => {
    const heroes = columns[column].heroes
    const others = Object.entries(shot.tilePicks[column] ?? {})
      .filter(([, unitId]) => !heroes.includes(unitId))
      .map(([hexId, unitId]) => ({ unitId, tile: Number(hexId) }))
    return {
      column,
      heroes: heroes.map((unitId) => ({ unitId, tile: tileOf(column, unitId) })),
      others,
    }
  }),
)

// The unit pointed at in a list, ringed on its tile.
const pointed = ref<{ column: Team; unitId: number } | null>(null)
const isPointed = (tile: TileView): boolean =>
  pointed.value !== null &&
  tile.column === pointed.value.column &&
  tile.unitId === pointed.value.unitId
</script>

<template>
  <div class="replay">
    <p class="note">{{ i18n.t('app.import-replay-hint') }}</p>
    <div class="replay-body">
      <div v-if="view" class="frame">
        <svg
          class="frame-view"
          :viewBox="`${view.box.x} ${view.box.y} ${view.box.w} ${view.box.h}`"
          role="img"
          :aria-label="shot.name"
          @click.self="picker = null"
        >
          <defs>
            <pattern
              :id="`hatch-${shot.id}`"
              patternUnits="userSpaceOnUse"
              width="12"
              height="12"
              patternTransform="rotate(45)"
            >
              <rect width="12" height="12" class="hatch-ground" />
              <line x1="0" y1="0" x2="0" y2="12" class="hatch-line" />
            </pattern>
            <clipPath v-for="tile in view.tiles" :id="`clip-${shot.id}-${tile.id}`" :key="tile.id">
              <circle :cx="tile.x" :cy="tile.y" :r="tile.width * 0.3" />
            </clipPath>
          </defs>
          <image :href="shot.thumb" x="0" y="0" :width="view.width" :height="view.height" />
          <g v-for="tile in view.tiles" :key="tile.id">
            <polygon
              class="tile"
              :class="[
                tile.kind,
                { picked: tile.unitId !== null, active: picker?.hexId === tile.id },
              ]"
              :points="tile.points"
              :fill="tile.kind === 'blocked' ? `url(#hatch-${shot.id})` : undefined"
              :role="tile.column === null ? undefined : 'button'"
              :tabindex="tile.column === null ? undefined : 0"
              :aria-label="
                tile.column === null ? undefined : i18n.t('app.import-tile', { tile: tile.id })
              "
              @click.stop="openPicker(tile)"
              @keydown.enter.prevent="openPicker(tile)"
            />
            <template v-if="tile.unitId !== null">
              <image
                :href="unitImage(tile.unitId)"
                :x="tile.x - tile.width * 0.3"
                :y="tile.y - tile.width * 0.3"
                :width="tile.width * 0.6"
                :height="tile.width * 0.6"
                :clip-path="`url(#clip-${shot.id}-${tile.id})`"
                class="tile-unit"
              />
              <circle
                class="tile-ring"
                :class="{ pointed: isPointed(tile) }"
                :cx="tile.x"
                :cy="tile.y"
                :r="tile.width * 0.3"
                :stroke-width="tile.width * (isPointed(tile) ? 0.07 : 0.035)"
              />
            </template>
            <text
              class="tile-number"
              :x="tile.x"
              :y="tile.unitId === null ? tile.y : tile.y + tile.width * 0.38"
              :font-size="tile.width * 0.2"
              :stroke-width="tile.width * 0.06"
              text-anchor="middle"
              dominant-baseline="central"
            >
              {{ tile.id }}
            </text>
          </g>
        </svg>
        <div
          v-if="picker"
          class="picker"
          :style="{ left: `${picker.left * 100}%`, top: `${picker.top * 100}%` }"
          role="menu"
          :aria-label="i18n.t('app.import-tile', { tile: picker.hexId })"
        >
          <span class="picker-head">{{ i18n.t('app.import-tile', { tile: picker.hexId }) }}</span>
          <button
            v-for="item in pickerItems"
            :key="item.unitId"
            type="button"
            class="picker-item"
            :class="{ on: item.unitId === pickedHere }"
            role="menuitem"
            @click.stop="pick(item.unitId)"
          >
            <img class="picker-portrait" :src="unitImage(item.unitId)" alt="" />
            <span class="picker-name">{{ unitName(item.unitId) }}</span>
            <span v-if="item.tile !== null && item.tile !== picker.hexId" class="picker-tile">
              {{ item.tile }}
            </span>
          </button>
          <button
            v-if="pickedHere !== null"
            type="button"
            class="picker-item clear"
            role="menuitem"
            @click.stop="pick(null)"
          >
            {{ i18n.t('app.import-clear-tile') }}
          </button>
        </div>
      </div>
      <p v-else class="note">{{ i18n.t('app.import-no-arena') }}</p>

      <div class="lineups">
        <div
          v-for="lineup in lineups"
          :key="lineup.column"
          class="lineup"
          :class="lineup.column === Team.ALLY ? 'left' : 'right'"
        >
          <div class="lineup-head">
            <span class="lineup-label">{{ i18n.t(teamLabelKey(lineup.column)) }}</span>
            <span v-if="swapSides" class="lineup-board">
              {{
                i18n.t('app.import-board-side', {
                  side: i18n.t(teamLabelKey(getOpposingTeam(lineup.column))),
                })
              }}
            </span>
          </div>
          <ul class="lineup-units">
            <li
              v-for="unit in [...lineup.heroes, ...lineup.others]"
              :key="unit.unitId"
              :class="{ missing: unit.tile === null }"
              @mouseenter="pointed = { column: lineup.column, unitId: unit.unitId }"
              @mouseleave="pointed = null"
            >
              <img class="lineup-portrait" :src="unitImage(unit.unitId)" alt="" />
              <span class="lineup-name">{{ unitName(unit.unitId) }}</span>
              <span class="lineup-tile">{{
                unit.tile === null
                  ? i18n.t('app.import-not-placed')
                  : i18n.t('app.import-tile', { tile: unit.tile })
              }}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.replay {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.note {
  margin: 0;
  font-size: 0.78rem;
  color: var(--import-text-dim);
}

.replay-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 240px;
  gap: var(--spacing-md);
  align-items: start;
}

@media (max-width: 720px) {
  .replay-body {
    grid-template-columns: minmax(0, 1fr);
  }
}

.frame {
  position: relative;
  min-width: 0;
}

.frame-view {
  display: block;
  width: 100%;
  height: auto;
  border-radius: var(--radius-medium);
  background: rgba(0, 0, 0, 0.35);
}

.tile {
  stroke: rgba(255, 255, 255, 0.45);
  stroke-width: 1.5;
}

/* A blocked tile's fill is its hatch, set on the element. */
.tile.neutral {
  fill: transparent;
}

.tile.ally,
.tile.enemy {
  cursor: pointer;
  stroke-width: 2;
}

.tile.ally {
  fill: color-mix(in srgb, var(--import-left) 22%, transparent);
  stroke: color-mix(in srgb, var(--import-left) 85%, white);
}

.tile.enemy {
  fill: color-mix(in srgb, var(--import-right) 24%, transparent);
  stroke: color-mix(in srgb, var(--import-right) 70%, white);
}

.tile.ally:hover,
.tile.enemy:hover,
.tile.ally:focus-visible,
.tile.enemy:focus-visible,
.tile.active {
  stroke: #fff;
  stroke-width: 3;
  outline: none;
}

.tile.blocked {
  stroke: rgba(255, 255, 255, 0.7);
  stroke-width: 2;
}

.hatch-ground {
  fill: rgba(0, 0, 0, 0.4);
}

.hatch-line {
  stroke: rgba(255, 255, 255, 0.45);
  stroke-width: 3;
}

.tile-unit {
  pointer-events: none;
}

.tile-ring {
  fill: none;
  stroke: #fff;
  pointer-events: none;
}

.tile-ring.pointed {
  stroke: var(--import-warn);
}

.tile-number {
  fill: #fff;
  stroke: rgba(0, 0, 0, 0.75);
  paint-order: stroke;
  font-family: sans-serif;
  font-weight: 700;
  pointer-events: none;
}

.picker {
  position: absolute;
  z-index: 2;
  transform: translate(-50%, 12px);
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 190px;
  max-height: 280px;
  overflow-y: auto;
  padding: 6px;
  border: 1px solid var(--import-border-strong);
  border-radius: var(--radius-medium);
  background: rgba(20, 22, 28, 0.96);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45);
}

.picker-head {
  padding: 2px 6px 4px;
  font-size: 0.7rem;
  color: var(--import-label);
}

.picker-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px;
  border: none;
  border-radius: var(--radius-small);
  background: none;
  color: var(--import-text);
  font: inherit;
  font-size: 0.8rem;
  text-align: left;
  cursor: pointer;
}

.picker-item:hover,
.picker-item:focus-visible {
  background: var(--import-surface-hover);
  outline: none;
}

.picker-item.on {
  background: var(--import-surface);
  font-weight: 700;
}

.picker-item.clear {
  justify-content: center;
  color: var(--import-bad);
}

.picker-portrait,
.lineup-portrait {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: cover;
  flex: none;
  background: var(--import-surface);
}

.picker-name,
.lineup-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.picker-tile {
  font-size: 0.7rem;
  color: var(--import-text-dim);
  font-variant-numeric: tabular-nums;
}

.lineups {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  min-width: 0;
}

.lineup-head {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 4px;
  font-size: 0.75rem;
}

.lineup-label {
  font-weight: 700;
}

.lineup.left .lineup-label {
  color: var(--import-left);
}

.lineup.right .lineup-label {
  color: var(--import-right);
}

.lineup-board {
  color: var(--import-text-dim);
}

.lineup-units {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.lineup-units li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 4px;
  border-radius: var(--radius-small);
  font-size: 0.8rem;
}

.lineup-units li:hover {
  background: var(--import-surface);
}

.lineup-tile {
  font-size: 0.72rem;
  color: var(--import-text-dim);
  font-variant-numeric: tabular-nums;
}

.lineup-units li.missing .lineup-tile {
  color: var(--import-warn);
}
</style>
