<script setup lang="ts">
/* Guide section for the two hero upgrades: a per-level stat table for each
   paragon faction group and one for EX refinement. Stats sharing a ramp share
   a row, with the step under the label. The three tables share one row when
   the panel is wide enough and stack otherwise. Labels resolve through the
   route locale so SSG bakes both languages. */

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

interface LevelHead {
  text: string
  tone: PillTone
}

interface StatRow {
  key: string
  names: string[]
  perLevel: string
  values: number[]
}

interface Block {
  key: string
  kind: 'paragon' | 'refinement'
  title: string
  factions: readonly string[]
  // Screen-reader text for the icon strip.
  who: string
  levels: LevelHead[]
  rows: StatRow[]
}

const levelHeads = (attrId: number, prefix: string): LevelHead[] =>
  Array.from({ length: attrMax(attrId) + 1 }, (_, level) => ({
    text: `${prefix}${level}`,
    tone: pillTone(attrId, level),
  }))

const statRows = (ramps: readonly StatRamp[], attrId: number, prefix: string): StatRow[] =>
  ramps.map((ramp) => ({
    key: ramp.stats.join(),
    names: ramp.stats.map(label),
    perLevel:
      ramp.base === 0
        ? interpolate(label('guide-upgrades-per-level'), { step: ramp.step })
        : interpolate(label('guide-upgrades-base-per-level'), {
            base: ramp.base,
            level: `${prefix}0`,
            step: ramp.step,
          }),
    values: rampValues(ramp, attrId),
  }))

const factionsOf = (group: ParagonGroup): string[] =>
  FACTION_ORDER.filter((faction) => paragonGroup(faction) === group)

const factionNames = (factions: readonly string[]): string =>
  factions.map((faction) => gameLabel(faction, props.lang)).join(' · ')

const paragonBlock = (group: ParagonGroup): Block => {
  const factions = factionsOf(group)
  return {
    key: group,
    kind: 'paragon',
    title: label('paragon'),
    factions,
    who: factionNames(factions),
    levels: levelHeads(ATTR_PARAGON, 'P'),
    rows: statRows(Object.values(PARAGON_RAMPS[group]), ATTR_PARAGON, 'P'),
  }
}

const blocks = computed((): Block[] => [
  paragonBlock('standard'),
  paragonBlock('celestialHypogean'),
  {
    key: 'refinement',
    kind: 'refinement',
    title: label('ex-refinement'),
    factions: FACTION_ORDER,
    who: label('all-factions'),
    levels: levelHeads(ATTR_REFINEMENT, 'R'),
    rows: statRows(REFINEMENT_RAMPS, ATTR_REFINEMENT, 'R'),
  },
])

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
    <div class="blocks">
      <div v-for="block in blocks" :key="block.key" class="block">
        <h3 class="block-title">{{ block.title }}</h3>
        <p class="block-who">
          <span v-if="block.factions.length" class="faction-icons">
            <img
              v-for="faction in block.factions"
              :key="faction"
              :src="gameData.getIcon(`faction-${faction}`)"
              alt=""
            />
          </span>
          <span class="visually-hidden">{{ block.who }}</span>
        </p>
        <table class="stat-table" :class="block.kind">
          <thead>
            <tr>
              <th scope="col"></th>
              <th
                v-for="level in block.levels"
                :key="level.text"
                scope="col"
                :class="{ 'max-col': level.tone === 'max' }"
              >
                <span class="lvl" :class="[block.kind, level.tone]">{{ level.text }}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in block.rows" :key="row.key">
              <th scope="row">
                <span v-for="name in row.names" :key="name" class="stat-name">{{ name }}</span>
                <span class="per-level">{{ row.perLevel }}</span>
              </th>
              <td
                v-for="(value, i) in row.values"
                :key="i"
                :class="{ 'max-col': i === row.values.length - 1 }"
              >
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
/* Sized as a container so the wide layout follows the panel, not the viewport
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

.block-title {
  margin: var(--spacing-xl) 0 2px;
  font-size: 15px;
  font-weight: 600;
}
.block-who {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin: 0 0 6px;
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
}
.faction-icons {
  display: inline-flex;
}
/* The ring is the guide panel's background (GuideView), so overlapped icons
   read as separate discs. */
.faction-icons img {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #262626;
  box-shadow: 0 0 0 1.5px #262626;
}
.faction-icons img + img {
  margin-left: -7px;
}
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.stat-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.stat-table th,
.stat-table td {
  padding: 10px 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  text-align: center;
  font-variant-numeric: tabular-nums;
  vertical-align: middle;
}
.stat-table thead th {
  padding: 6px 8px 8px;
  border-bottom-color: rgba(255, 255, 255, 0.14);
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.6);
  vertical-align: bottom;
  white-space: nowrap;
}
.stat-table tbody th {
  text-align: left;
}
.stat-table tbody th {
  font-weight: 400;
}
.stat-table tbody tr:last-child th,
.stat-table tbody tr:last-child td {
  border-bottom: none;
}
/* The max column answers "what do I get fully upgraded", so it carries the
   pill's max tint. */
.stat-table .max-col {
  font-weight: 700;
}
.stat-table.paragon .max-col {
  background: color-mix(in srgb, var(--upgrade-pill-paragon-max) 13%, transparent);
}
.stat-table.refinement .max-col {
  background: color-mix(in srgb, var(--upgrade-pill-refinement-max) 13%, transparent);
}
/* Each stat wears the skill text's stat-tag look, so a shared-ramp row reads
   as a list of stats rather than a block of prose. */
.stat-name {
  display: block;
  width: fit-content;
  margin-bottom: 3px;
  padding: 1px 7px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.08);
  font-size: 0.93em;
  line-height: 1.4;
  white-space: nowrap;
}
.per-level {
  display: block;
  margin-top: 2px;
  font-size: 11.5px;
  color: var(--color-accent);
  white-space: nowrap;
}

/* Level headers wear the portrait pill's look, one tone each. */
.lvl {
  display: inline-block;
  min-width: 34px;
  padding: 4px 9px 3px;
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

/* Wide panels: the three tables share a row. */
@container (min-width: 960px) {
  .blocks {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0 22px;
    align-items: start;
  }
  .stat-table {
    font-size: 13px;
  }
  .stat-table th,
  .stat-table td {
    padding: 8px 3px;
  }
  .stat-table tbody th {
    padding-left: 4px;
  }
  .stat-name,
  .per-level {
    white-space: normal;
  }
  .lvl {
    min-width: 32px;
    padding: 4px 7px 3px;
  }
}

/* Six columns must still fit a 360px phone. */
@container (max-width: 420px) {
  .stat-table {
    font-size: 13px;
  }
  .stat-table th,
  .stat-table td {
    padding: 8px 4px;
  }
  .stat-name {
    padding: 1px 5px;
  }
  .stat-name,
  .per-level {
    white-space: normal;
  }
  .lvl {
    min-width: 30px;
    padding: 4px 6px 3px;
    font-size: 10px;
  }
}
</style>
