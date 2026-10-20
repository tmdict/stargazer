<script setup lang="ts">
/* A replay frame's review: Stargazer's board drawn where the battle camera
   puts it on the paused frame, every tile numbered, each team's deployment
   tiles tinted and the blocked ones hatched (they should sit on the walls).
   A click on a free deployment tile places that side's next unit there: the
   one chosen in the lists, else the first one without a tile in the side's
   placing order: the heroes of the map's result screenshot, each with its
   companions, then the phantimal the picks field. A click on a placed unit,
   or with nothing to place, opens a picker of the side's units instead; a
   tile number typed beside a unit in the lists places it too, Enter moving
   on to the next.
   Heroes may have moved before the pause, so the tile is the reviewer's
   call. The "As placed" board beside the frame shows the sides as the plan
   will place them. Every pick is an edit on the shot; nothing here touches a
   board. */

import { computed, onMounted, onUnmounted, ref } from 'vue'

import TeamImportPlaced from '@/components/teams/TeamImportPlaced.vue'
import type { ImportShot } from '@/composables/useTeamImport'
import { useUnitLabels } from '@/composables/useUnitLabels'
import { BOARD_HEXES } from '@/lib/import/board'
import { replayHexCentre, replayHexCorners } from '@/lib/import/replay'
import { isReplayReading } from '@/lib/import/types'
import { MAPS } from '@/lib/maps'
import { placingOrder } from '@/lib/teams/formationImport'
import type { SideLoadBoard } from '@/lib/teams/sideLoad'
import { SIDES } from '@/lib/teams/teamImport'
import { State } from '@/lib/types/state'
import { Team, teamLabelKey } from '@/lib/types/team'
import { useI18nStore } from '@/stores/i18n'

const { shot, mapKey, sides, placed } = defineProps<{
  shot: ImportShot
  // The map the frame's board stands on; null while the frame has no board.
  mapKey: string | null
  // The frame's board sides as the plan places them; null without a board.
  placed: Partial<Record<Team, SideLoadBoard>> | null
  // Per board side: the heroes the plan puts there, and every unit it can field.
  sides: Record<Team, { heroes: readonly number[]; options: readonly number[] }>
}>()

const emit = defineEmits<{
  setPick: [id: string, side: Team, hexId: number, unitId: number | null]
}>()

const i18n = useI18nStore()
const { unitName, unitImage } = useUnitLabels()

type TileKind = 'ally' | 'enemy' | 'blocked' | 'neutral'

// The frame shows each team on the half it fought from, so a deployment
// tile's kind is its board side whether or not the match's sides are swapped.
const KIND_SIDE: Partial<Record<TileKind, Team>> = { ally: Team.ALLY, enemy: Team.ENEMY }

// A placed unit's portrait spans this share of its tile's width; a larger
// one hides the units standing next to it on the frame.
const MARK = 0.2

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
  side: Team | null
  unitId: number | null
}

// A pick counts while its unit is one the side fields, so a swap that gives
// the side the other team's heroes hides it until swapped back.
const sidePicks = (side: Team): Map<number, number> =>
  new Map(
    Object.entries(shot.tilePicks[side] ?? {})
      .filter(([, unitId]) => sides[side].options.includes(unitId))
      .map(([hexId, unitId]) => [Number(hexId), unitId]),
  )
const picks = computed((): Record<Team, Map<number, number>> => ({
  [Team.ALLY]: sidePicks(Team.ALLY),
  [Team.ENEMY]: sidePicks(Team.ENEMY),
}))

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
    const side = KIND_SIDE[kind] ?? null
    return {
      id,
      points: corners.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' '),
      x: centre.x,
      y: centre.y,
      width: Math.max(...xs) - Math.min(...xs),
      kind,
      side,
      unitId: side === null ? null : (picks.value[side].get(id) ?? null),
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

const tileOf = (side: Team, unitId: number): number | null =>
  [...picks.value[side]].find(([, id]) => id === unitId)?.[0] ?? null

// ---------- placing ----------

const sideOrder = (side: Team): number[] =>
  placingOrder(sides[side].heroes, [...picks.value[side].values()])
const orders = computed((): Record<Team, number[]> => ({
  [Team.ALLY]: sideOrder(Team.ALLY),
  [Team.ENEMY]: sideOrder(Team.ENEMY),
}))

// Per side, a unit chosen in the lists to place next, or null after the
// reviewer stops placing; absent, the first unit of its order without a tile
// goes next.
const chosen = ref<Partial<Record<Team, number | null>>>({})

const nextFor = (side: Team): number | null => {
  const choice = chosen.value[side]
  if (choice === null) return null
  if (choice !== undefined && sides[side].options.includes(choice)) return choice
  return orders.value[side].find((unitId) => tileOf(side, unitId) === null) ?? null
}
const nextUnits = computed((): Record<Team, number | null> => ({
  [Team.ALLY]: nextFor(Team.ALLY),
  [Team.ENEMY]: nextFor(Team.ENEMY),
}))

// Choosing the unit already next stops placing, so tile clicks open the picker.
const choose = (side: Team, unitId: number): void => {
  chosen.value = { ...chosen.value, [side]: nextUnits.value[side] === unitId ? null : unitId }
}

const clickTile = (tile: TileView): void => {
  const side = tile.side
  const next = side !== null && tile.unitId === null ? nextUnits.value[side] : null
  if (side === null || next === null) {
    openPicker(tile)
    return
  }
  picker.value = null
  emit('setPick', shot.id, side, tile.id, next)
  chosen.value = { ...chosen.value, [side]: undefined }
}

const hoveredTile = ref<number | null>(null)
const preview = computed(() => {
  const tile = view.value?.tiles.find((t) => t.id === hoveredTile.value)
  if (!tile || tile.side === null || tile.unitId !== null || picker.value) return null
  const unitId = nextUnits.value[tile.side]
  return unitId === null ? null : { tile, unitId }
})

// ---------- picking ----------

interface Picker {
  hexId: number
  side: Team
  // Where the tile is, as a fraction of the drawn frame.
  left: number
  top: number
}

const picker = ref<Picker | null>(null)

// Escape closes only the picker: heard on capture, before the modal's own
// listener would close the import and drop every shot with it.
const closeOnEscape = (event: KeyboardEvent): void => {
  if (event.key !== 'Escape' || !picker.value) return
  event.stopPropagation()
  picker.value = null
}
onMounted(() => document.addEventListener('keydown', closeOnEscape, { capture: true }))
onUnmounted(() => document.removeEventListener('keydown', closeOnEscape, { capture: true }))

// A tile no team deploys on closes the picker, as a click on the frame does.
const openPicker = (tile: TileView): void => {
  const box = view.value?.box
  if (tile.side === null || !box) {
    picker.value = null
    return
  }
  picker.value =
    picker.value?.hexId === tile.id
      ? null
      : {
          hexId: tile.id,
          side: tile.side,
          left: (tile.x - box.x) / box.w,
          top: (tile.y - box.y) / box.h,
        }
}

const pickerItems = computed(() => {
  const target = picker.value
  if (!target) return { heroes: [], extras: [] }
  const { heroes, options } = sides[target.side]
  const item = (unitId: number) => ({ unitId, tile: tileOf(target.side, unitId) })
  return {
    heroes: heroes.map(item),
    extras: options.filter((unitId) => !heroes.includes(unitId)).map(item),
  }
})

const pickedHere = computed(() => {
  const target = picker.value
  return target ? (picks.value[target.side].get(target.hexId) ?? null) : null
})

const pick = (unitId: number | null): void => {
  const target = picker.value
  if (!target) return
  emit('setPick', shot.id, target.side, target.hexId, unitId)
  picker.value = null
}

// ---------- lineups ----------

const lineups = computed(() =>
  SIDES.map((side) => {
    const order = orders.value[side]
    const others = [...picks.value[side]]
      .filter(([, unitId]) => !order.includes(unitId))
      .map(([tile, unitId]) => ({ unitId, tile }))
    return {
      side,
      units: [...order.map((unitId) => ({ unitId, tile: tileOf(side, unitId) })), ...others],
    }
  }),
)

// The unit pointed at or typed for in a list, ringed on its tile.
const pointed = ref<{ team: Team; unitId: number } | null>(null)
const isPointed = (tile: TileView): boolean =>
  pointed.value !== null && tile.side === pointed.value.team && tile.unitId === pointed.value.unitId

// ---------- typed tiles ----------

const lineupsEl = ref<HTMLElement>()
const typeError = ref<string | null>(null)

/* A tile number typed beside a unit: one of its team's deployment tiles
 * places the unit there, taking it off any other as a tap does; an empty box
 * takes it off the board; anything else is refused, said so, and the box goes
 * back to the unit's tile, returning false. */
const typeTile = (side: Team, unitId: number, input: HTMLInputElement): boolean => {
  const text = input.value.trim()
  const current = tileOf(side, unitId)
  if (text === '') {
    typeError.value = null
    if (current !== null) emit('setPick', shot.id, side, current, null)
    return true
  }
  const hexId = Number(text)
  if (Number.isInteger(hexId) && KIND_SIDE[tileKinds.value.get(hexId) ?? 'neutral'] === side) {
    typeError.value = null
    if (hexId !== current) emit('setPick', shot.id, side, hexId, unitId)
    return true
  }
  typeError.value = i18n.t('app.import-tile-refused', {
    tile: text,
    side: i18n.t(teamLabelKey(side)),
  })
  input.value = current === null ? '' : String(current)
  return false
}

// Enter places the unit and moves on to the next box, so a team is typed in
// one go; a refused number keeps the box, selected for typing again.
const typeTileAndNext = (side: Team, unitId: number, event: KeyboardEvent): void => {
  const input = event.target as HTMLInputElement
  if (!typeTile(side, unitId, input)) {
    input.select()
    return
  }
  const boxes = [...(lineupsEl.value?.querySelectorAll<HTMLInputElement>('.lineup-tile') ?? [])]
  const next = boxes[boxes.indexOf(input) + 1]
  if (next) {
    next.focus()
    next.select()
  } else {
    input.blur()
  }
}
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
          @click="picker = null"
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
              <circle :cx="tile.x" :cy="tile.y" :r="tile.width * MARK" />
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
              :role="tile.side === null ? undefined : 'button'"
              :tabindex="tile.side === null ? undefined : 0"
              :aria-label="
                tile.side === null ? undefined : i18n.t('app.import-tile', { tile: tile.id })
              "
              @click.stop="clickTile(tile)"
              @keydown.enter.prevent="clickTile(tile)"
              @mouseenter="hoveredTile = tile.id"
              @mouseleave="hoveredTile = null"
            />
            <template v-if="tile.unitId !== null">
              <image
                :href="unitImage(tile.unitId)"
                :x="tile.x - tile.width * MARK"
                :y="tile.y - tile.width * MARK"
                :width="tile.width * MARK * 2"
                :height="tile.width * MARK * 2"
                :clip-path="`url(#clip-${shot.id}-${tile.id})`"
                class="tile-unit"
              />
              <circle
                class="tile-ring"
                :class="{ pointed: isPointed(tile) }"
                :cx="tile.x"
                :cy="tile.y"
                :r="tile.width * MARK"
                :stroke-width="tile.width * (isPointed(tile) ? 0.05 : 0.025)"
              />
            </template>
            <text
              class="tile-number"
              :x="tile.x"
              :y="tile.unitId === null ? tile.y : tile.y + tile.width * (MARK + 0.12)"
              :font-size="tile.width * 0.2"
              :stroke-width="tile.width * 0.06"
              text-anchor="middle"
              dominant-baseline="central"
            >
              {{ tile.id }}
            </text>
          </g>
          <g v-if="preview" class="tile-preview">
            <image
              :href="unitImage(preview.unitId)"
              :x="preview.tile.x - preview.tile.width * MARK"
              :y="preview.tile.y - preview.tile.width * MARK"
              :width="preview.tile.width * MARK * 2"
              :height="preview.tile.width * MARK * 2"
              :clip-path="`url(#clip-${shot.id}-${preview.tile.id})`"
            />
            <circle
              class="preview-ring"
              :cx="preview.tile.x"
              :cy="preview.tile.y"
              :r="preview.tile.width * MARK"
              :stroke-width="preview.tile.width * 0.03"
              :stroke-dasharray="`${preview.tile.width * 0.06} ${preview.tile.width * 0.045}`"
            />
          </g>
        </svg>
        <div
          v-if="picker"
          class="picker"
          :style="{ '--tile-x': `${picker.left * 100}%`, top: `${picker.top * 100}%` }"
          role="menu"
          :aria-label="i18n.t('app.import-tile', { tile: picker.hexId })"
        >
          <span class="picker-head">{{ i18n.t('app.import-tile', { tile: picker.hexId }) }}</span>
          <div class="picker-heroes">
            <button
              v-for="item in pickerItems.heroes"
              :key="item.unitId"
              type="button"
              class="picker-item hero"
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
          </div>
          <div v-if="pickerItems.extras.length" class="picker-extras">
            <button
              v-for="item in pickerItems.extras"
              :key="item.unitId"
              type="button"
              class="picker-item extra"
              :class="{ on: item.unitId === pickedHere }"
              role="menuitem"
              :title="unitName(item.unitId)"
              :aria-label="unitName(item.unitId)"
              @click.stop="pick(item.unitId)"
            >
              <img class="picker-portrait" :src="unitImage(item.unitId)" alt="" />
            </button>
          </div>
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

      <TeamImportPlaced v-if="view && placed && mapKey" :map-key :sides="placed" :pointed />

      <div v-if="view" ref="lineupsEl" class="lineups">
        <div
          v-for="lineup in lineups"
          :key="lineup.side"
          class="lineup"
          :class="lineup.side === Team.ALLY ? 'left' : 'right'"
        >
          <div class="lineup-head">
            <span class="lineup-label">{{ i18n.t(teamLabelKey(lineup.side)) }}</span>
          </div>
          <ul class="lineup-units">
            <li
              v-for="unit in lineup.units"
              :key="unit.unitId"
              :class="{ missing: unit.tile === null, next: nextUnits[lineup.side] === unit.unitId }"
              @mouseenter="pointed = { team: lineup.side, unitId: unit.unitId }"
              @mouseleave="pointed = null"
            >
              <button
                type="button"
                class="lineup-pick"
                :aria-pressed="nextUnits[lineup.side] === unit.unitId"
                @click="choose(lineup.side, unit.unitId)"
              >
                <img class="lineup-portrait" :src="unitImage(unit.unitId)" alt="" />
                <span class="lineup-name">{{ unitName(unit.unitId) }}</span>
                <span v-if="nextUnits[lineup.side] === unit.unitId" class="lineup-next">
                  {{ i18n.t('app.next') }}
                </span>
              </button>
              <input
                class="lineup-tile"
                type="text"
                inputmode="numeric"
                maxlength="2"
                :value="unit.tile ?? ''"
                :aria-label="i18n.t('app.import-tile-for', { name: unitName(unit.unitId) })"
                @focus="pointed = { team: lineup.side, unitId: unit.unitId }"
                @blur="pointed = null"
                @change="typeTile(lineup.side, unit.unitId, $event.target as HTMLInputElement)"
                @keydown.enter.prevent="typeTileAndNext(lineup.side, unit.unitId, $event)"
              />
            </li>
          </ul>
        </div>
        <p v-if="typeError" class="type-error" role="alert">{{ typeError }}</p>
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
  grid-template-columns: minmax(0, 1fr) 300px;
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
  opacity: 0.85;
  pointer-events: none;
}

.tile-ring {
  fill: none;
  stroke: #fff;
  pointer-events: none;
}

.tile-preview {
  opacity: 0.75;
  pointer-events: none;
}

.preview-ring {
  fill: none;
  stroke: #fff;
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
  --picker-half: 162px;
  position: absolute;
  z-index: 2;
  left: clamp(var(--picker-half), var(--tile-x), calc(100% - var(--picker-half)));
  width: max-content;
  max-width: calc(2 * var(--picker-half));
  transform: translate(-50%, 12px);
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
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

.picker-heroes {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  max-width: calc(5 * 58px + 4 * 4px);
}

.picker-item.hero {
  position: relative;
  flex-direction: column;
  gap: 3px;
  width: 58px;
  padding: 5px 2px;
}

.picker-item .picker-portrait {
  width: 40px;
  height: 40px;
}

.picker-item.hero .picker-name {
  max-width: 100%;
  font-size: 0.68rem;
  text-align: center;
}

.picker-item.hero .picker-tile {
  position: absolute;
  top: 2px;
  right: 4px;
  padding: 0 4px;
  border-radius: var(--radius-small);
  background: var(--import-surface-hover);
  color: var(--import-text);
}

.picker-extras {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  padding-top: 6px;
  border-top: 1px solid var(--import-border);
}

.picker-item.extra {
  padding: 3px;
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
  grid-column: 1;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--spacing-sm) var(--spacing-lg);
  min-width: 0;
}

@media (max-width: 720px) {
  .lineups {
    grid-column: auto;
  }
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

.lineup-units li:hover,
.lineup-units li.next {
  background: var(--import-surface);
}

.lineup.left li.next {
  box-shadow: inset 3px 0 0 var(--import-left);
}

.lineup.right li.next {
  box-shadow: inset 3px 0 0 var(--import-right);
}

.lineup-pick {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 0;
  border: none;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.lineup-next {
  flex: none;
  padding: 1px 6px;
  border-radius: var(--radius-medium);
  font-size: 0.62rem;
  color: #fff;
}

.lineup.left .lineup-next {
  background: var(--import-left);
}

.lineup.right .lineup-next {
  background: var(--import-right);
}

.lineup-tile {
  width: 3.4em;
  flex: none;
  padding: 3px 6px;
  border: 1px solid var(--import-border);
  border-radius: var(--radius-small);
  background: var(--import-surface);
  color: var(--import-text);
  font: inherit;
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.lineup-tile:focus-visible {
  border-color: var(--import-border-strong);
  outline: none;
}

.lineup-units li.missing .lineup-tile {
  border-color: var(--import-warn);
}

.type-error {
  grid-column: 1 / -1;
  margin: 0;
  font-size: 0.75rem;
  color: var(--import-bad);
}
</style>
