<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

import FilterIcons from '@/components/ui/FilterIcons.vue'
import TooltipPopup from '@/components/ui/TooltipPopup.vue'
import { useInfoTip } from '@/composables/useInfoTip'
import heroBuffs from '@/data/wandwars/hero-buffs.json'
import { compareByOrder, FACTION_ORDER } from '@/lib/filterOrder'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import { formatName } from '@/wandwars/formatting'

defineProps<{
  characterImages: Record<string, string>
}>()

const i18n = useI18nStore()
const gameDataStore = useGameDataStore()

const factionFilter = ref('')

const factionOptions = computed(() =>
  [...new Set(gameDataStore.characters.map((c) => c.faction))].sort(),
)

const factionByHero = computed(() => {
  const map = new Map<string, string>()
  for (const c of gameDataStore.characters) map.set(c.name, c.faction)
  return map
})

interface AdjustmentRow {
  hero: string
  hp: number
  atk: number
  physDef: number
  magicDef: number
  total: number
}

// Headers use short labels so they fit the narrowest cells; the Σ header's
// title spells out the full stat names.
const STAT_COLUMNS = [
  { field: 'hp', headerKey: 'game.hp' },
  { field: 'atk', headerKey: 'game.atk' },
  { field: 'physDef', headerKey: 'wandwars.phys-def-short' },
  { field: 'magicDef', headerKey: 'wandwars.magic-def-short' },
] as const
type StatField = (typeof STAT_COLUMNS)[number]['field']
type SortField = StatField | 'total'

// The data file holds multiple patches; only the most recent is shown.
const latestBuffs = (heroBuffs.patches[heroBuffs.patches.length - 1]?.buffs ?? []) as Partial<
  Omit<AdjustmentRow, 'total'>
>[]

const allRows: AdjustmentRow[] = latestBuffs.map((b) => {
  const hp = b.hp ?? 0
  const atk = b.atk ?? 0
  const physDef = b.physDef ?? 0
  const magicDef = b.magicDef ?? 0
  return { hero: b.hero ?? '', hp, atk, physDef, magicDef, total: hp + atk + physDef + magicDef }
})

const filteredRows = computed(() =>
  factionFilter.value
    ? allRows.filter((r) => factionByHero.value.get(r.hero) === factionFilter.value)
    : allRows,
)

const VIEW_MODES = ['ranked', 'faction', 'profile'] as const
type ViewMode = (typeof VIEW_MODES)[number]
const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  ranked: 'wandwars.ranked',
  faction: 'game.faction',
  profile: 'wandwars.profile',
}
const viewMode = ref<ViewMode>('ranked')
const sortField = ref<SortField>('total')

interface WallRow {
  key: string
  hero: string
  label: string
  isGroup?: boolean
  title: string
  values: AdjustmentRow
}

interface WallSection {
  key: string
  faction?: string
  count?: number
  avgTotal?: number
  heading?: string
  continued?: boolean
  rows: WallRow[]
}

function toWallRow(row: AdjustmentRow): WallRow {
  const label = formatName(row.hero)
  return { key: row.hero, hero: row.hero, label, title: label, values: row }
}

function byTotalDesc(a: AdjustmentRow, b: AdjustmentRow): number {
  return b.total - a.total || a.hero.localeCompare(b.hero)
}

// Column count follows the measured wall width, capped at MAX_COLUMNS; it
// starts at 2 until the observer measures (flex-wrap stacks overflow columns
// meanwhile). MIN_COLUMN_WIDTH and COLUMN_GAP mirror .wall-col min-width and
// the .wall gap.
const MAX_COLUMNS = 3
const MIN_COLUMN_WIDTH = 320
const COLUMN_GAP = 24

const wallEl = ref<HTMLElement | null>(null)
const columnCount = ref(2)
let wallObserver: ResizeObserver | undefined

onMounted(() => {
  wallObserver = new ResizeObserver((entries) => {
    const width = entries[0]?.contentRect.width ?? 0
    columnCount.value = Math.max(
      1,
      Math.min(MAX_COLUMNS, Math.floor((width + COLUMN_GAP) / (MIN_COLUMN_WIDTH + COLUMN_GAP))),
    )
  })
  if (wallEl.value) wallObserver.observe(wallEl.value)
})

onUnmounted(() => wallObserver?.disconnect())

// Balance sections across columns, reading order preserved (each column top
// to bottom, left to right). A section splits mid-run only when both parts
// keep at least MIN_SPLIT_ROWS; the tail is marked continued so its band or
// heading repeats without the count/avg (those describe the whole section).
// Columns shorter than MIN_COLUMN_ROWS aren't opened: stubs read worse than
// fewer, fuller columns.
const MIN_SPLIT_ROWS = 4
const MIN_COLUMN_ROWS = 6

function balanceColumns(sections: WallSection[], maxColumns: number): WallSection[][] {
  const total = sections.reduce((sum, s) => sum + s.rows.length, 0)
  const count = Math.max(1, Math.min(maxColumns, Math.floor(total / MIN_COLUMN_ROWS)))
  if (count === 1) return [sections]
  const columns: WallSection[][] = []
  const queue = [...sections]
  let rowsLeft = total
  while (columns.length < count - 1 && queue.length) {
    const target = Math.round(rowsLeft / (count - columns.length))
    const column: WallSection[] = []
    let used = 0
    while (queue.length && used < target) {
      const section = queue[0]
      const len = section.rows.length
      const remaining = target - used
      if (len < remaining + MIN_SPLIT_ROWS) {
        column.push(section)
        queue.shift()
        used += len
      } else if (remaining >= MIN_SPLIT_ROWS) {
        column.push({ ...section, rows: section.rows.slice(0, remaining) })
        queue[0] = {
          ...section,
          key: `${section.key}-continued-${columns.length}`,
          continued: true,
          rows: section.rows.slice(remaining),
        }
        used = target
      } else {
        // Neither fits nor splits cleanly; it opens the next column instead.
        break
      }
    }
    columns.push(column)
    rowsLeft -= used
  }
  if (queue.length) columns.push(queue)
  return columns
}

// Every mode reduces to the same shape (columns of sections of rows), so the
// template stays a single structure:
// - ranked: one flat run, re-sortable by any stat column
// - faction: per-faction bands
// - profile: heroes with identical stat vectors collapse into one ×N row,
//   with one-off tunings listed after
const wallColumns = computed<WallSection[][]>(() => {
  const rows = filteredRows.value

  if (viewMode.value === 'ranked') {
    const field = sortField.value
    const sorted = [...rows].sort((a, b) => b[field] - a[field] || a.hero.localeCompare(b.hero))
    return balanceColumns([{ key: 'ranked', rows: sorted.map(toWallRow) }], columnCount.value)
  }

  if (viewMode.value === 'faction') {
    const factions = [...new Set(rows.map((r) => factionByHero.value.get(r.hero) ?? ''))].sort(
      (a, b) => compareByOrder(a, b, FACTION_ORDER),
    )
    const sections = factions.map((faction) => {
      const members = rows
        .filter((r) => factionByHero.value.get(r.hero) === faction)
        .sort(byTotalDesc)
      const avgTotal = Math.round(members.reduce((sum, r) => sum + r.total, 0) / members.length)
      return {
        key: faction,
        faction,
        count: members.length,
        avgTotal,
        rows: members.map(toWallRow),
      }
    })
    return balanceColumns(sections, columnCount.value)
  }

  const groups = new Map<string, AdjustmentRow[]>()
  for (const row of rows) {
    const key = `${row.hp}/${row.atk}/${row.physDef}/${row.magicDef}`
    const members = groups.get(key)
    if (members) members.push(row)
    else groups.set(key, [row])
  }
  const groupRows: WallRow[] = [...groups.entries()]
    .filter(([, members]) => members.length > 1)
    .sort((a, b) => b[1].length - a[1].length || byTotalDesc(a[1][0], b[1][0]))
    .map(([key, members]) => {
      const sorted = [...members].sort((a, b) => a.hero.localeCompare(b.hero))
      const first = sorted[0]
      return {
        key,
        hero: first.hero,
        label: `×${members.length}`,
        isGroup: true,
        title: sorted.map((m) => formatName(m.hero)).join(', '),
        values: first,
      }
    })
  const singleRows = [...groups.values()]
    .filter((members) => members.length === 1)
    .map((members) => members[0])
    .sort(byTotalDesc)
    .map(toWallRow)
  const sections: WallSection[] = []
  if (groupRows.length) sections.push({ key: 'groups', rows: groupRows })
  if (singleRows.length) {
    sections.push({
      key: 'singles',
      heading: i18n.t('wandwars.one-off-tunings'),
      rows: singleRows,
    })
  }
  return balanceColumns(sections, columnCount.value)
})

// Fill steps are white-mixed tints of the success teal / error red, kept at
// pastel strength: the value is printed in every non-zero cell, so the fill
// only carries relative magnitude.
function statCellClass(value: number): string {
  if (value === 0) return 'cell-zero'
  if (value <= -20) return 'cell-neg-2'
  if (value < 0) return 'cell-neg-1'
  if (value >= 60) return 'cell-pos-4'
  if (value >= 40) return 'cell-pos-3'
  if (value >= 20) return 'cell-pos-2'
  return 'cell-pos-1'
}

// Σ spans a wider range than single stats, so it gets its own bins mapped
// onto the same fill steps.
function totalCellClass(total: number): string {
  if (total < 0) return 'cell-neg-2'
  if (total >= 180) return 'cell-pos-4'
  if (total >= 120) return 'cell-pos-3'
  if (total >= 60) return 'cell-pos-2'
  return 'cell-pos-1'
}

function formatStat(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value}%`
}

const totalHeaderTitle = computed(
  () =>
    `Σ = ${i18n.t('game.hp')} + ${i18n.t('game.atk')} + ${i18n.t('game.phys-def')} + ${i18n.t('game.magic-def')}`,
)

// One tip serves both Σ headers. The ranked header is also the sort button,
// so it only wires hover (tap sorts); the wall header is info-only, so tap
// shows the tip there.
const {
  anchor: totalTipAnchor,
  hoverOpen: totalTipOpen,
  hoverClose: totalTipClose,
  toggle: totalTipToggle,
  onTouchStart: totalTipTouchStart,
} = useInfoTip()
</script>

<template>
  <section class="adjustments-panel">
    <div class="filters-row">
      <FilterIcons
        v-model="factionFilter"
        icon-prefix="faction"
        :options="factionOptions"
        :size="32"
        :show-tooltip="false"
        active-border-color="var(--color-primary)"
      />
      <div class="view-toggle">
        <button
          v-for="mode in VIEW_MODES"
          :key="mode"
          type="button"
          :class="['view-btn', { active: viewMode === mode }]"
          @click="viewMode = mode"
        >
          {{ i18n.t(VIEW_MODE_LABELS[mode]) }}
        </button>
      </div>
    </div>

    <div ref="wallEl" class="wall">
      <div v-for="(column, columnIndex) in wallColumns" :key="columnIndex" class="wall-col">
        <div class="wall-row wall-head">
          <span />
          <span class="head-hero">{{ i18n.t('wandwars.hero') }}</span>
          <template v-if="viewMode === 'ranked'">
            <button
              v-for="col in STAT_COLUMNS"
              :key="col.field"
              type="button"
              :class="['head-cell', 'sortable', { active: sortField === col.field }]"
              @click="sortField = col.field"
            >
              {{ i18n.t(col.headerKey) }}
            </button>
            <button
              type="button"
              :class="['head-cell', 'sortable', { active: sortField === 'total' }]"
              @mouseenter="totalTipOpen"
              @mouseleave="totalTipClose"
              @touchstart.passive="totalTipTouchStart"
              @click="sortField = 'total'"
            >
              Σ
            </button>
          </template>
          <template v-else>
            <span v-for="col in STAT_COLUMNS" :key="col.field" class="head-cell">
              {{ i18n.t(col.headerKey) }}
            </span>
            <span
              class="head-cell"
              @mouseenter="totalTipOpen"
              @mouseleave="totalTipClose"
              @click="totalTipToggle"
              @touchstart.passive="totalTipTouchStart"
              >Σ</span
            >
          </template>
        </div>

        <template v-for="section in column" :key="section.key">
          <div v-if="section.faction" class="wall-band">
            <img
              :src="gameDataStore.getIcon(`faction-${section.faction}`)"
              :alt="section.faction"
              class="band-icon"
            />
            <span>{{ i18n.t(`game.${section.faction}`) }}</span>
            <template v-if="!section.continued">
              <span class="band-count">×{{ section.count }}</span>
              <span v-if="section.avgTotal !== undefined" class="band-avg">
                {{ i18n.t('wandwars.avg') }} Σ
                <span :class="['band-avg-pill', totalCellClass(section.avgTotal)]">
                  {{ formatStat(section.avgTotal) }}
                </span>
              </span>
            </template>
          </div>
          <div v-else-if="section.heading" class="wall-divider">{{ section.heading }}</div>

          <div v-for="row in section.rows" :key="row.key" class="wall-row" :title="row.title">
            <img
              v-if="characterImages[row.hero]"
              :src="characterImages[row.hero]"
              loading="lazy"
              decoding="async"
              :alt="row.label"
              class="hero-portrait"
            />
            <span v-else class="hero-portrait hero-portrait-missing" />
            <span :class="['hero-name', { 'group-count': row.isGroup }]">{{ row.label }}</span>
            <span
              v-for="col in STAT_COLUMNS"
              :key="col.field"
              :class="['cell', statCellClass(row.values[col.field])]"
            >
              {{ row.values[col.field] === 0 ? '' : formatStat(row.values[col.field]) }}
            </span>
            <span :class="['cell', totalCellClass(row.values.total)]">
              {{ formatStat(row.values.total) }}
            </span>
          </div>
        </template>
      </div>
    </div>

    <Teleport to="body">
      <TooltipPopup
        v-if="totalTipAnchor"
        :target-element="totalTipAnchor"
        variant="detailed"
        max-width="260px"
      >
        <template #content>{{ totalHeaderTitle }}</template>
      </TooltipPopup>
    </Teleport>
  </section>
</template>

<style scoped>
.adjustments-panel {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  padding: 0 var(--spacing-md) var(--spacing-md);
  /* TabView's panel inset is sized for card-based tabs; pull the filter row
     up so it sits closer to the tab strip. */
  margin-top: calc(-1 * var(--spacing-md));
}

/* TabView's mobile insets are smaller than the pull-up, which would swallow
   the tab-strip gap entirely. */
@media (max-width: 768px) {
  .adjustments-panel {
    margin-top: 0;
  }
}

.filters-row {
  display: flex;
  gap: var(--spacing-md);
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
}

.view-toggle {
  display: inline-flex;
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-medium);
  overflow: hidden;
  background: var(--color-bg-white);
}

.view-btn {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 5px 12px;
  border: 0;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.view-btn + .view-btn {
  border-left: 1px solid var(--color-border-primary);
}

.view-btn:hover {
  background: var(--color-bg-secondary);
}

.view-btn.active {
  background: var(--color-primary);
  color: var(--color-bg-white);
}

.wall {
  display: flex;
  gap: var(--spacing-xl);
  flex-wrap: wrap;
  align-items: flex-start;
}

.wall-col {
  flex: 1 1 380px;
  min-width: 320px;
  /* A lone column (short filtered lists) shouldn't stretch cells into slabs. */
  max-width: 640px;
}

.wall-row {
  display: grid;
  /* The name column gives way (ellipsis) before the stat cells can starve
     and let header labels overlap. */
  grid-template-columns: 30px minmax(60px, 106px) repeat(5, minmax(42px, 1fr));
  gap: 2px;
  align-items: center;
  margin-bottom: 2px;
}

.wall-head span,
.wall-head button {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--color-text-secondary);
  text-align: center;
  white-space: nowrap;
}

.wall-head .head-hero {
  text-align: left;
}

.head-cell.sortable {
  background: transparent;
  border: 0;
  cursor: pointer;
  padding: 2px 0;
}

.head-cell.sortable:hover {
  color: var(--color-text-primary);
}

/* Sort is always descending, so the active column only needs marking, not a
   direction glyph; underline keeps the header width constant. */
.head-cell.sortable.active {
  color: var(--color-primary-hover);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.hero-portrait {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  object-fit: cover;
  object-position: center 20%;
}

.hero-portrait-missing {
  display: block;
  background: var(--color-bg-secondary);
}

.hero-name {
  font-size: 0.7rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-right: 4px;
}

.hero-name.group-count {
  color: var(--color-primary-hover);
}

.cell {
  height: 24px;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.66rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

/* Diverging fills: white-mixed steps of the success teal (buffs) and error
   red (nerfs), monotone in lightness per arm; neutral parchment marks zero. */
.cell-zero {
  background: #f1eee7;
  color: #b6b0a2;
}

.cell-pos-1 {
  background: #e6f4f3;
  color: #1f4b45;
}

.cell-pos-2 {
  background: #c7e8e5;
  color: #1f4b45;
}

.cell-pos-3 {
  background: #9ed7d3;
  color: #1f4b45;
}

.cell-pos-4 {
  background: #73c4bf;
  color: #1f4b45;
}

.cell-neg-1 {
  background: #f7e3e3;
  color: #7a1d1d;
}

.cell-neg-2 {
  background: #e59e9e;
  color: #6b1a1a;
}

.wall-band {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin: var(--spacing-md) 0 var(--spacing-xs);
  font-size: 0.72rem;
  font-weight: 700;
}

.band-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
}

.band-count {
  color: var(--color-text-secondary);
  font-weight: 400;
}

.band-avg {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.66rem;
  font-weight: 400;
  color: var(--color-text-secondary);
}

.band-avg-pill {
  padding: 1px 7px;
  border-radius: 999px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.wall-divider {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--color-text-secondary);
  margin: var(--spacing-md) 0 var(--spacing-xs);
}
</style>
