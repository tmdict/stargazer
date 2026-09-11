<script setup lang="ts">
/* Guide section for the two hero upgrades as one matrix: a row per attribute,
   a column band per ramp variant (paragon for the standard factions, paragon
   for Celestial and Hypogean, EX refinement), each band P0..P4 plus its step.
   A stat an upgrade does not touch shows a dash. Narrow panels swap the matrix
   for one table per band with the step under the stat name. Labels resolve
   through the route locale so SSG bakes both languages. */

import { computed } from 'vue'

import { ATTR_PARAGON, ATTR_REFINEMENT, attrMax } from '@/lib/characters/attributes'
import {
  PARAGON_RAMPS,
  paragonGroup,
  pillTone,
  rampValues,
  REFINEMENT_RAMPS,
  type ParagonGroup,
  type PillTone,
  type StatRamp,
} from '@/lib/characters/upgradeStats'
import { FACTION_ORDER } from '@/lib/filterOrder'
import type { AppLocale } from '@/lib/types/i18n'
import { useGameDataStore } from '@/stores/gameData'
import { interpolate } from '@/utils/interpolate'
import { appLabel, gameLabel } from '@/utils/skillLabels'

const props = defineProps<{ lang: AppLocale }>()

const gameData = useGameDataStore()

const label = (key: string): string => appLabel(key, props.lang)

type UpgradeKind = 'paragon' | 'refinement'

interface LevelHead {
  text: string
  tone: PillTone
}

interface Band {
  key: string
  kind: UpgradeKind
  title: string
  // Icon strip; empty for refinement, which applies to every faction.
  factions: readonly string[]
  // Faction names read out behind the icon strip.
  who?: string
  levels: LevelHead[]
  ramps: readonly StatRamp[]
  attrId: number
}

interface Cell {
  kind: UpgradeKind
  values: number[]
  step: string
  perLevel: string
}

interface AttrRow {
  key: string
  name: string
  // Last stat of a shared-ramp group; a heavier rule follows it.
  groupEnd: boolean
  // One entry per band; null where that upgrade does not touch the stat.
  cells: (Cell | null)[]
}

const levelHeads = (attrId: number, prefix: string): LevelHead[] =>
  Array.from({ length: attrMax(attrId) + 1 }, (_, level) => ({
    text: `${prefix}${level}`,
    tone: pillTone(attrId, level),
  }))

const factionsOf = (group: ParagonGroup): string[] =>
  FACTION_ORDER.filter((faction) => paragonGroup(faction) === group)

const paragonRamps = (group: ParagonGroup): StatRamp[] => {
  const { energy, combat, rivalry } = PARAGON_RAMPS[group]
  return [energy, combat, rivalry]
}

const paragonBand = (group: ParagonGroup): Band => {
  const factions = factionsOf(group)
  return {
    key: group,
    kind: 'paragon',
    title: label('paragon'),
    factions,
    who: factions.map((faction) => gameLabel(faction, props.lang)).join(' · '),
    levels: levelHeads(ATTR_PARAGON, 'P'),
    ramps: paragonRamps(group),
    attrId: ATTR_PARAGON,
  }
}

const bands = computed((): Band[] => [
  paragonBand('standard'),
  paragonBand('celestialHypogean'),
  {
    key: 'refinement',
    kind: 'refinement',
    title: label('ex-refinement'),
    factions: [],
    levels: levelHeads(ATTR_REFINEMENT, 'R'),
    ramps: REFINEMENT_RAMPS,
    attrId: ATTR_REFINEMENT,
  },
])

const cellFor = (band: Band, stat: string): Cell | null => {
  const ramp = band.ramps.find((r) => r.stats.includes(stat))
  if (!ramp) return null
  return {
    kind: band.kind,
    values: rampValues(ramp, band.attrId),
    step: `+${ramp.step}`,
    perLevel: interpolate(label('step-per-level'), { step: ramp.step }),
  }
}

// Row order follows the paragon ramps (every stat has one), so stats sharing
// a ramp sit together and the group rule falls between ramps.
const rows = computed((): AttrRow[] => {
  const ramps = paragonRamps('standard')
  return ramps.flatMap((ramp, r) =>
    ramp.stats.map((stat, s) => ({
      key: stat,
      name: label(stat),
      groupEnd: s === ramp.stats.length - 1 && r < ramps.length - 1,
      cells: bands.value.map((band) => cellFor(band, stat)),
    })),
  )
})

// Per band, only the rows it feeds (the narrow stack has no dash rows).
const stackRows = computed(() =>
  bands.value.map((_, b) =>
    rows.value.flatMap((row) => {
      const cell = row.cells[b]
      return cell ? [{ row, cell }] : []
    }),
  ),
)

const isMax = (values: readonly unknown[], i: number): boolean => i === values.length - 1

const levelClass = (band: Band, level: LevelHead) => ({
  'max-col': level.tone === 'max',
  [band.kind]: level.tone === 'max',
})

const valueClass = (cell: Cell, i: number) => ({
  'max-col': isMax(cell.values, i),
  [cell.kind]: isMax(cell.values, i),
})

const intro = computed((): string => {
  const [factionA = '', factionB = ''] = factionsOf('celestialHypogean')
  return interpolate(label('guide-upgrades-intro'), {
    factionA: gameLabel(factionA, props.lang),
    factionB: gameLabel(factionB, props.lang),
  })
})
</script>

<template>
  <section class="upgrade-section">
    <h2 class="section-title">{{ label('guide-upgrades') }}</h2>
    <p class="intro">{{ intro }}</p>

    <!-- Wide panels: one matrix, bands side by side. -->
    <table class="stat-table matrix">
      <thead>
        <!-- A band title spans its level columns only, so it centers on P0..P4
             and the step column keeps an empty cell beside it. -->
        <tr class="bands">
          <td></td>
          <template v-for="band in bands" :key="band.key">
            <th scope="colgroup" :colspan="band.levels.length" class="band-start">
              {{ band.title }}
              <template v-if="band.factions.length">
                <span class="faction-icons">
                  <img
                    v-for="faction in band.factions"
                    :key="faction"
                    :src="gameData.getIcon(`faction-${faction}`)"
                    alt=""
                  />
                </span>
                <span class="visually-hidden">{{ band.who }}</span>
              </template>
            </th>
            <td></td>
          </template>
        </tr>
        <tr>
          <td></td>
          <template v-for="band in bands" :key="band.key">
            <th
              v-for="(level, i) in band.levels"
              :key="level.text"
              scope="col"
              :class="[levelClass(band, level), { 'band-start': i === 0 }]"
            >
              <span class="lvl" :class="[band.kind, level.tone]">{{ level.text }}</span>
            </th>
            <th scope="col" class="step-head">{{ label('per-level') }}</th>
          </template>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.key" :class="{ 'group-end': row.groupEnd }">
          <th scope="row">
            <span class="stat-name">{{ row.name }}</span>
          </th>
          <template v-for="(cell, b) in row.cells" :key="bands[b].key">
            <template v-if="cell">
              <td
                v-for="(value, i) in cell.values"
                :key="i"
                :class="[valueClass(cell, i), { 'band-start': i === 0 }]"
              >
                {{ value }}
              </td>
              <td class="step">
                <span class="per-level">{{ cell.step }}</span>
              </td>
            </template>
            <template v-else>
              <td
                v-for="i in bands[b].levels.length"
                :key="i"
                class="none"
                :class="{ 'band-start': i === 1 }"
              >
                –
              </td>
              <td class="step"></td>
            </template>
          </template>
        </tr>
      </tbody>
    </table>

    <!-- Narrow panels: one table per band, the step under the stat name. -->
    <div class="stack">
      <div v-for="(band, b) in bands" :key="band.key">
        <h3 class="block-title">
          {{ band.title }}
          <template v-if="band.factions.length">
            <span class="faction-icons">
              <img
                v-for="faction in band.factions"
                :key="faction"
                :src="gameData.getIcon(`faction-${faction}`)"
                alt=""
              />
            </span>
            <span class="visually-hidden">{{ band.who }}</span>
          </template>
        </h3>
        <table class="stat-table">
          <thead>
            <tr>
              <td></td>
              <th
                v-for="level in band.levels"
                :key="level.text"
                scope="col"
                :class="levelClass(band, level)"
              >
                <span class="lvl" :class="[band.kind, level.tone]">{{ level.text }}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="{ row, cell } in stackRows[b]"
              :key="row.key"
              :class="{ 'group-end': row.groupEnd }"
            >
              <th scope="row">
                <span class="stat-name">{{ row.name }}</span>
                <span class="per-level">{{ cell.perLevel }}</span>
              </th>
              <td v-for="(value, i) in cell.values" :key="i" :class="valueClass(cell, i)">
                {{ value }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* Sized as a container so the layout follows the panel, not the viewport
   (the panel fills the window minus the page padding, so the two differ). */
.upgrade-section {
  container-type: inline-size;
}

/* Heading rule matches GuideTagSection's. */
.section-title {
  margin: 0;
  padding-bottom: var(--spacing-sm);
  border-bottom: 2px solid var(--color-border-primary);
  font-size: 18px;
  font-weight: 600;
}
.intro {
  margin: var(--spacing-sm) 0 0;
  font-size: 13px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.6);
}

.stat-table {
  width: 100%;
  margin-top: var(--spacing-lg);
  border-collapse: collapse;
  font-size: 14px;
}
.matrix {
  font-size: 13px;
}
.stat-table th,
.stat-table td {
  padding: 7px 4px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  text-align: center;
  font-variant-numeric: tabular-nums;
  vertical-align: middle;
}
/* Top padding lets the max column's tint clear the pill instead of starting
   at its edge; the band row above gives up the same amount. */
.stat-table thead th,
.stat-table thead td {
  padding: 6px 4px 8px;
  border-bottom-color: rgba(255, 255, 255, 0.14);
}
.stat-table tbody th {
  padding-left: 0;
  text-align: left;
  font-weight: 400;
  white-space: nowrap;
}
.stat-table tbody tr:last-child th,
.stat-table tbody tr:last-child td {
  border-bottom: none;
}
/* Stats sharing a ramp sit together; a heavier rule marks the group edge. */
.stat-table tr.group-end th,
.stat-table tr.group-end td {
  border-bottom-color: rgba(255, 255, 255, 0.2);
}

.stat-table .bands th,
.stat-table .bands td {
  padding-top: 0;
  padding-bottom: 2px;
  border-bottom: none;
  font-weight: 600;
  white-space: nowrap;
}
.stat-table .band-start {
  border-left: 1px solid rgba(255, 255, 255, 0.12);
  padding-left: 12px;
}
.step-head {
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.45);
  white-space: nowrap;
}
.stat-table .step {
  padding-left: 6px;
  text-align: left;
  white-space: nowrap;
}
.none {
  color: rgba(255, 255, 255, 0.22);
}

/* The max column answers "what do I get fully upgraded", so it carries the
   pill's max tint. */
.max-col {
  font-weight: 700;
}
.max-col.paragon {
  background: color-mix(in srgb, var(--upgrade-pill-paragon-max) 13%, transparent);
}
.max-col.refinement {
  background: color-mix(in srgb, var(--upgrade-pill-refinement-max) 13%, transparent);
}

/* Each stat wears the skill text's stat-tag look. */
.stat-name {
  display: inline-block;
  padding: 1px 7px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.08);
  font-size: 0.93em;
  line-height: 1.4;
  white-space: nowrap;
}
.per-level {
  font-size: 11.5px;
  color: var(--color-accent);
  white-space: nowrap;
}

.faction-icons {
  display: inline-flex;
  vertical-align: middle;
  margin-left: 8px;
}
/* The ring is the guide panel's background (GuideView), so overlapped icons
   read as separate discs. */
.faction-icons img {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #262626;
  box-shadow: 0 0 0 1.5px #262626;
}
.faction-icons img + img {
  margin-left: -5px;
}
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

/* Level headers wear the portrait pill's look, one tone each. */
.lvl {
  display: inline-block;
  min-width: 30px;
  padding: 4px 6px 3px;
  border: 1.5px solid #fff;
  border-radius: 999px;
  background: var(--upgrade-pill-gray);
  color: var(--upgrade-pill-gray-text);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.03em;
  line-height: 1;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
}
.lvl.paragon.max {
  background: var(--upgrade-pill-paragon-max);
  color: #fff;
}
.lvl.refinement.mid {
  background: var(--upgrade-pill-refinement-mid);
}
.lvl.refinement.max {
  background: var(--upgrade-pill-refinement-max);
  color: #fff;
}

/* Narrow panels: the matrix needs about 940px, so below that one table per
   band takes over. */
.stack {
  display: none;
}
.block-title {
  margin: var(--spacing-xl) 0 2px;
  font-size: 15px;
  font-weight: 600;
}
.stack .stat-table {
  margin-top: 0;
}
.stack .per-level {
  display: block;
  margin-top: 2px;
}
@container (max-width: 959px) {
  .matrix {
    display: none;
  }
  .stack {
    display: block;
  }
}

/* Six columns must still fit a 360px phone. */
@container (max-width: 420px) {
  .stat-table {
    font-size: 13px;
  }
  .stat-table th,
  .stat-table td {
    padding: 7px 3px;
  }
  .stat-table tbody th,
  .stat-name {
    white-space: normal;
  }
  .lvl {
    min-width: 28px;
    padding: 3px 5px;
    font-size: 10px;
  }
  .faction-icons img {
    width: 16px;
    height: 16px;
  }
}
</style>
