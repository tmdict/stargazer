<script setup lang="ts">
/* A replay frame's review: Stargazer's board drawn where the battle camera
   puts it on the paused frame, every tile numbered, each team's deployment
   tiles tinted and the blocked ones hatched (they should sit on the walls).
   Each side's units are placed on its tiles by click or typed tile number
   (useTilePlacing), in the side's placing order: the heroes of the map's
   result screenshot, then the phantimal the picks field, else the one the
   lineup qualifies for, each with its companions.
   Heroes may have moved before the pause, so the tile is the reviewer's
   call. The "As placed" board beside the frame shows the sides as the plan
   will place them. Every pick is an edit on the shot; nothing here touches a
   board. */

import { computed, ref } from 'vue'

import TeamImportNextBadge from '@/components/teams/TeamImportNextBadge.vue'
import TeamImportPlaceCount from '@/components/teams/TeamImportPlaceCount.vue'
import TeamImportPlaced from '@/components/teams/TeamImportPlaced.vue'
import TeamImportTile, { TILE_EDGE, tileOutline } from '@/components/teams/TeamImportTile.vue'
import TeamImportTileBox from '@/components/teams/TeamImportTileBox.vue'
import TeamImportTileMark from '@/components/teams/TeamImportTileMark.vue'
import TeamImportTileNumber from '@/components/teams/TeamImportTileNumber.vue'
import TeamImportTilePicker from '@/components/teams/TeamImportTilePicker.vue'
import type { ImportShot } from '@/composables/useTeamImport'
import { useTilePlacing, type PlacingSide } from '@/composables/useTilePlacing'
import { useUnitLabels } from '@/composables/useUnitLabels'
import { BOARD_HEXES } from '@/lib/import/screens/formation/board'
import { replayHexCentre, replayHexCorners } from '@/lib/import/screens/replay/replay'
import { isReplayReading } from '@/lib/import/screens/replay/types'
import { MAPS } from '@/lib/maps'
import { replayPlacing } from '@/lib/teams/formationImport'
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

// A placed unit's portrait radius as a share of its tile's width; a larger
// one hides the units standing next to it on the frame.
const MARK = 0.2
// An empty tile's edge, lighter than a deployment tile's, and the blocked
// tiles' hatching, its spacing and line, as shares of a tile's width.
const NEUTRAL_EDGE = TILE_EDGE * 0.75
const HATCH = 0.07
const HATCH_LINE = 0.0175

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

const sidePlacing = (side: Team): PlacingSide => {
  const { heroes, options } = sides[side]
  return { ...replayPlacing(heroes, options, shot.tilePicks[side] ?? {}), heroes, options }
}
const placings = computed((): Record<Team, PlacingSide> => ({
  [Team.ALLY]: sidePlacing(Team.ALLY),
  [Team.ENEMY]: sidePlacing(Team.ENEMY),
}))

const view = computed(() => {
  const reading = shot.reading
  if (!reading || !isReplayReading(reading) || !reading.placement) return null
  const placement = reading.placement
  const tiles: TileView[] = BOARD_HEXES.map((hex) => {
    const id = hex.getId()
    const centre = replayHexCentre(placement, hex)
    const kind = tileKinds.value.get(id) ?? 'neutral'
    const side = KIND_SIDE[kind] ?? null
    return {
      id,
      ...tileOutline(replayHexCorners(placement, hex)),
      x: centre.x,
      y: centre.y,
      kind,
      side,
      unitId: side === null ? null : (placings.value[side].picks.get(id) ?? null),
    }
  })
  // The board with room above it for the units standing on the far rows.
  const corners = BOARD_HEXES.flatMap((hex) => replayHexCorners(placement, hex))
  const tile = Math.max(...tiles.map((t) => t.width))
  const { width, height } = reading.size
  const mean = tiles.reduce((sum, t) => sum + t.width, 0) / tiles.length
  const hatch = { size: mean * HATCH, line: mean * HATCH_LINE }
  const x0 = Math.max(0, Math.min(...corners.map((c) => c.x)) - tile * 0.5)
  const y0 = Math.max(0, Math.min(...corners.map((c) => c.y)) - tile * 1.6)
  const x1 = Math.min(width, Math.max(...corners.map((c) => c.x)) + tile * 0.5)
  const y1 = Math.min(height, Math.max(...corners.map((c) => c.y)) + tile * 0.4)
  return { box: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, width, height, tiles, hatch }
})

// ---------- placing ----------

const {
  nextUnits,
  choose,
  clickTile,
  hovered,
  preview,
  picker,
  pickerItems,
  pickedHere,
  pick,
  rows,
  typeError,
  typeTile,
  typeTileAndNext,
} = useTilePlacing({
  sides: () => placings.value,
  refusal: (side, hexId, text) =>
    KIND_SIDE[tileKinds.value.get(hexId) ?? 'neutral'] === side
      ? null
      : i18n.t('app.import-tile-refused', { tile: text, side: i18n.t(teamLabelKey(side)) }),
  setPick: (side, hexId, unitId) => emit('setPick', shot.id, side, hexId, unitId),
})

const clickFrameTile = (tile: TileView, side: Team): void => {
  const box = view.value?.box
  if (!box) return
  clickTile({
    hexId: tile.id,
    side,
    left: (tile.x - box.x) / box.w,
    top: (tile.y - box.y) / box.h,
  })
}

const previewTile = computed(() => {
  const shown = preview.value
  const tile = shown ? view.value?.tiles.find((t) => t.id === shown.hexId) : undefined
  return shown && tile ? { tile, unitId: shown.unitId } : null
})

// ---------- lineups ----------

const lineups = computed(() =>
  SIDES.map((side) => {
    const units = rows(side)
    return { side, units, placed: units.filter((unit) => unit.tile !== null).length }
  }),
)

// The unit pointed at or typed for in a list, ringed on its tile.
const pointed = ref<{ team: Team; unitId: number } | null>(null)
const isPointed = (tile: TileView): boolean =>
  pointed.value !== null && tile.side === pointed.value.team && tile.unitId === pointed.value.unitId

const lineupsEl = ref<HTMLElement>()
const tileBoxes = (): HTMLInputElement[] => [
  ...(lineupsEl.value?.querySelectorAll<HTMLInputElement>('.tile-box') ?? []),
]
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
        >
          <defs>
            <pattern
              :id="`hatch-${shot.id}`"
              patternUnits="userSpaceOnUse"
              :width="view.hatch.size"
              :height="view.hatch.size"
              patternTransform="rotate(45)"
            >
              <rect :width="view.hatch.size" :height="view.hatch.size" class="hatch-ground" />
              <line
                x1="0"
                y1="0"
                x2="0"
                :y2="view.hatch.size"
                class="hatch-line"
                :stroke-width="view.hatch.line"
              />
            </pattern>
          </defs>
          <image :href="shot.thumb" x="0" y="0" :width="view.width" :height="view.height" />
          <g v-for="tile in view.tiles" :key="tile.id">
            <TeamImportTile
              v-if="tile.side !== null"
              :points="tile.points"
              :tile-width="tile.width"
              :side="tile.side"
              :active="picker?.hexId === tile.id"
              role="button"
              tabindex="0"
              :aria-label="i18n.t('app.import-tile', { tile: tile.id })"
              @click.stop="clickFrameTile(tile, tile.side)"
              @keydown.enter.prevent="clickFrameTile(tile, tile.side)"
              @mouseenter="hovered = { side: tile.side, hexId: tile.id }"
              @mouseleave="hovered = null"
            />
            <polygon
              v-else
              class="tile"
              :class="tile.kind"
              :points="tile.points"
              :fill="tile.kind === 'blocked' ? `url(#hatch-${shot.id})` : undefined"
              :stroke-width="tile.width * (tile.kind === 'blocked' ? TILE_EDGE : NEUTRAL_EDGE)"
            />
            <TeamImportTileMark
              v-if="tile.unitId !== null"
              :x="tile.x"
              :y="tile.y"
              :radius="tile.width * MARK"
              :tile-width="tile.width"
              :href="unitImage(tile.unitId)"
              :pointed="isPointed(tile)"
            />
            <TeamImportTileNumber
              :x="tile.x"
              :y="tile.unitId === null ? tile.y : tile.y + tile.width * (MARK + 0.12)"
              :tile-width="tile.width"
              :hex-id="tile.id"
            />
          </g>
          <TeamImportTileMark
            v-if="previewTile"
            preview
            :x="previewTile.tile.x"
            :y="previewTile.tile.y"
            :radius="previewTile.tile.width * MARK"
            :tile-width="previewTile.tile.width"
            :href="unitImage(previewTile.unitId)"
          />
        </svg>
        <TeamImportTilePicker
          v-if="picker"
          :picker
          :items="pickerItems"
          :picked-here
          @pick="pick"
        />
      </div>
      <p v-else class="note">{{ i18n.t('app.import-no-arena') }}</p>

      <TeamImportPlaced v-if="view && placed && mapKey" :map-key :sides="placed" :pointed />

      <div v-if="view" ref="lineupsEl" class="lineups">
        <div
          v-for="lineup in lineups"
          :key="lineup.side"
          class="lineup"
          :class="lineup.side === Team.ALLY ? 'ally' : 'enemy'"
        >
          <div class="lineup-head">
            <span class="lineup-label">{{ i18n.t(teamLabelKey(lineup.side)) }}</span>
            <TeamImportPlaceCount :placed="lineup.placed" :total="lineup.units.length" />
          </div>
          <ul class="lineup-units">
            <li
              v-for="unit in lineup.units"
              :key="unit.unitId"
              :class="{ next: nextUnits[lineup.side] === unit.unitId }"
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
                <TeamImportNextBadge
                  v-if="nextUnits[lineup.side] === unit.unitId"
                  :side="lineup.side"
                />
              </button>
              <TeamImportTileBox
                :tile="unit.tile"
                :label="i18n.t('app.import-tile-for', { name: unitName(unit.unitId) })"
                @focus="pointed = { team: lineup.side, unitId: unit.unitId }"
                @blur="pointed = null"
                @change="typeTile(lineup.side, unit.unitId, $event.target as HTMLInputElement)"
                @keydown.enter.prevent="
                  typeTileAndNext(lineup.side, unit.unitId, $event, tileBoxes())
                "
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
}

.tile.neutral {
  fill: transparent;
}

.tile.blocked {
  stroke: rgba(255, 255, 255, 0.7);
}

.hatch-ground {
  fill: rgba(0, 0, 0, 0.4);
}

.hatch-line {
  stroke: rgba(255, 255, 255, 0.45);
}

.lineup-portrait {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: cover;
  flex: none;
  background: var(--import-surface);
}

.lineup-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  align-items: baseline;
  gap: 6px;
  margin-bottom: 4px;
  font-size: 0.75rem;
}

.lineup-label {
  font-weight: 700;
}

.lineup.ally .lineup-label {
  color: var(--color-ally);
}

.lineup.enemy .lineup-label {
  color: var(--color-enemy);
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

.lineup.ally li.next {
  box-shadow: inset 3px 0 0 var(--color-ally);
}

.lineup.enemy li.next {
  box-shadow: inset 3px 0 0 var(--color-enemy);
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

.type-error {
  grid-column: 1 / -1;
  margin: 0;
  font-size: 0.75rem;
  color: var(--import-bad);
}
</style>
