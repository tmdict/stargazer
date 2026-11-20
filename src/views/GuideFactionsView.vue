<script setup lang="ts">
/* Guide page for the game's two faction rules: the team's ATK and HP bonus,
   one row per step with an example team, and the wheel of factions that
   counter each other. */

import { computed } from 'vue'

import {
  FACTION_BONUS_STEPS,
  stepTeam,
  TACTICS_PERCENT,
  TACTICS_WHEEL,
  TEAM_SIZE,
  WILD_FACTION_PERCENT,
  WILD_FACTIONS,
} from '@/lib/factionBonus'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import { setupGuideContentMeta } from '@/utils/contentMeta'
import { interpolate } from '@/utils/interpolate'
import { appLabel, gameLabel } from '@/utils/skillLabels'

import '@/styles/content.css'
import '@/styles/guide.css'

const i18n = useI18nStore()
const lang = computed(() => i18n.currentLocale)
setupGuideContentMeta(lang, 'factions')

const gameData = useGameDataStore()
// The faction icons resolve through the store.
gameData.initializeContentData()

const label = (key: string): string => appLabel(key, lang.value)
const faction = (key: string): string => gameLabel(key, lang.value)
const icon = (key: string): string => gameData.getIcon(`faction-${key}`)
const signed = (percent: number): string => `${percent > 0 ? '+' : '−'}${Math.abs(percent)}%`

interface BonusRow {
  key: string
  // One faction per deployed hero; null is a hero that does not count.
  team: (string | null)[]
  count: string
  percent: number
  // The step and the Celestial and Hypogean share, when the row has both.
  parts?: string
}

const stepPercent = (size: number): number =>
  FACTION_BONUS_STEPS.find(({ groups }) => groups.length === 1 && groups[0] === size)?.percent ?? 0

const fill = (team: string[]): (string | null)[] => [
  ...team,
  ...Array<null>(TEAM_SIZE - team.length).fill(null),
]

const wildRow = (same: number, wild: number): BonusRow => {
  const step = stepPercent(same + wild)
  const extra = wild * WILD_FACTION_PERCENT
  return {
    key: `wild-${wild}`,
    team: [
      ...Array<string>(same).fill(TACTICS_WHEEL[0]),
      ...Array.from({ length: wild }, (_, i) => WILD_FACTIONS[i % WILD_FACTIONS.length]!),
    ],
    count: String(same + wild),
    percent: step + extra,
    parts: `${step}% + ${extra}%`,
  }
}

const STEP_ROWS: readonly BonusRow[] = FACTION_BONUS_STEPS.map(({ groups, percent }) => ({
  key: groups.join('-'),
  team: fill(stepTeam(groups)),
  count: groups.join(' + '),
  percent,
}))

const WILD_ROWS: readonly BonusRow[] = [wildRow(3, 2), wildRow(0, TEAM_SIZE)]

const wild = computed(() => ({
  celestial: faction('celestial'),
  hypogean: faction('hypogean'),
}))

// The wheel: a faction every quarter turn, counter-clockwise from the top. An
// outer arrow runs from each to the faction it is strong against, and an
// inner one back from that faction.
const WHEEL = { size: 400, radius: 150, inner: 112, icon: 60, gap: 22, innerGap: 24 }
const centre = WHEEL.size / 2
const point = (degrees: number, radius: number): { x: number; y: number } => ({
  x: centre + radius * Math.cos((degrees * Math.PI) / 180),
  y: centre + radius * Math.sin((degrees * Math.PI) / 180),
})
const arc = (radius: number, from: number, to: number, clockwise: boolean): string => {
  const start = point(from, radius)
  const end = point(to, radius)
  return `M${start.x.toFixed(1)} ${start.y.toFixed(1)} A${radius} ${radius} 0 0 ${clockwise ? 1 : 0} ${end.x.toFixed(1)} ${end.y.toFixed(1)}`
}
const wheel = TACTICS_WHEEL.map((key, i) => {
  const at = -90 - i * 90
  return {
    key,
    icon: point(at, WHEEL.radius),
    strong: arc(WHEEL.radius, at - WHEEL.gap, at - 90 + WHEEL.gap, false),
    strongLabel: point(at - 45, WHEEL.radius + 30),
    weak: arc(WHEEL.inner, at - 90 + WHEEL.innerGap, at - WHEEL.innerGap, true),
    weakLabel: point(at - 45, WHEEL.inner - 38),
  }
})

const wheelSummary = computed(() =>
  TACTICS_WHEEL.map((key, i) => {
    const next = TACTICS_WHEEL[(i + 1) % TACTICS_WHEEL.length]!
    return `${faction(key)} → ${faction(next)}`
  }).join(', '),
)

const bonusBlocks = computed(() => [
  { rows: STEP_ROWS, parts: false, notes: [label('faction-bonus-pair')] },
  {
    rows: WILD_ROWS,
    parts: true,
    notes: [
      interpolate(label('faction-bonus-any'), wild.value),
      interpolate(label('faction-bonus-extra'), wild.value),
    ],
  },
])
</script>

<template>
  <main>
    <article class="container page-panel guide-panel">
      <div class="content">
        <h1>{{ label('faction-bonus') }}</h1>
        <p>{{ label('faction-bonus-intro') }}</p>

        <div class="bonus">
          <template v-for="(block, b) in bonusBlocks" :key="b">
            <table class="guide-table">
              <thead>
                <tr>
                  <th scope="col" colspan="2">{{ label('same-faction-heroes') }}</th>
                  <th scope="col" class="gain">{{ faction('atk') }} / {{ faction('hp') }}</th>
                  <td v-if="block.parts"></td>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in block.rows" :key="row.key">
                  <td class="team">
                    <span class="pips">
                      <template v-for="(member, i) in row.team" :key="i">
                        <img v-if="member" :src="icon(member)" :alt="faction(member)" />
                        <span v-else class="pip-empty"></span>
                      </template>
                    </span>
                  </td>
                  <th scope="row">{{ row.count }}</th>
                  <td class="gain">{{ signed(row.percent) }}</td>
                  <td v-if="block.parts" class="parts">{{ row.parts }}</td>
                </tr>
              </tbody>
            </table>
            <div class="notes">
              <p v-for="note in block.notes" :key="note">{{ note }}</p>
            </div>
          </template>
        </div>

        <h2>{{ label('tactics') }}</h2>
        <div class="tactics">
          <!-- The guide panel is dark in both looks, so the wheel takes the dark colours. -->
          <div data-theme="dark">
            <svg
              class="wheel"
              :viewBox="`0 0 ${WHEEL.size} ${WHEEL.size}`"
              role="img"
              :aria-label="wheelSummary"
            >
              <defs>
                <marker
                  v-for="kind in ['strong', 'weak']"
                  :id="`tactics-tip-${kind}`"
                  :key="kind"
                  :class="kind"
                  viewBox="0 0 10 10"
                  refX="7"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto"
                >
                  <path d="M0 1 L8 5 L0 9" />
                </marker>
              </defs>
              <g v-for="spoke in wheel" :key="spoke.key">
                <path class="strong" :d="spoke.strong" marker-end="url(#tactics-tip-strong)" />
                <text class="strong" :x="spoke.strongLabel.x" :y="spoke.strongLabel.y">
                  {{ signed(TACTICS_PERCENT) }}
                </text>
                <path class="weak" :d="spoke.weak" marker-end="url(#tactics-tip-weak)" />
                <text class="weak" :x="spoke.weakLabel.x" :y="spoke.weakLabel.y">
                  {{ signed(-TACTICS_PERCENT) }}
                </text>
                <image
                  :href="icon(spoke.key)"
                  :x="spoke.icon.x - WHEEL.icon / 2"
                  :y="spoke.icon.y - WHEEL.icon / 2"
                  :width="WHEEL.icon"
                  :height="WHEEL.icon"
                />
              </g>
            </svg>
            <ul class="legend">
              <li><span class="swatch"></span>{{ label('tactics-arrow') }}</li>
              <li><span class="swatch weak"></span>{{ label('tactics-arrow-less') }}</li>
            </ul>
          </div>

          <div>
            <p>{{ label('tactics-intro') }}</p>
            <p>{{ label('tactics-cycle') }}</p>
          </div>
        </div>
      </div>
    </article>
  </main>
</template>

<style scoped>
.bonus {
  display: grid;
  grid-auto-flow: column;
  grid-template-rows: auto auto;
  grid-auto-columns: minmax(0, 1fr);
  align-items: start;
  gap: 0 48px;
  margin: 16px 0 8px;
}
.bonus .notes {
  margin-top: 12px;
}
.bonus .team {
  width: 1%;
  padding-left: 0;
  white-space: nowrap;
}
.bonus tbody th {
  text-align: left;
  color: var(--reading-muted);
}
.bonus .gain {
  width: 96px;
  text-align: right;
  white-space: nowrap;
}
.bonus td.gain {
  font-weight: 700;
  color: var(--color-success);
}
.bonus .parts {
  width: 84px;
  padding-right: 0;
  font-size: var(--reading-small-size);
  text-align: right;
  white-space: nowrap;
  color: var(--reading-muted);
}
.pips {
  display: inline-flex;
  gap: 4px;
  vertical-align: middle;
}
.pips img,
.pip-empty {
  width: 24px;
  height: 24px;
  border-radius: 50%;
}
.pip-empty {
  box-sizing: border-box;
  border: 1.5px dashed rgba(255, 255, 255, 0.22);
}

.tactics {
  display: grid;
  grid-template-columns: minmax(0, 440px) minmax(0, 1fr);
  align-items: center;
  gap: 48px;
  margin: 12px 0 8px;
}
.wheel {
  display: block;
  width: 100%;
  max-width: 440px;
  margin: 0 auto;
}
.wheel path {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.wheel g > path {
  stroke-width: 3;
}
.wheel marker path {
  stroke-width: 1.8;
}
.wheel g > path.weak {
  stroke-dasharray: 2 7;
}
.wheel path.strong,
.wheel .strong path {
  stroke: var(--color-success);
}
.wheel path.weak,
.wheel .weak path {
  stroke: var(--color-danger-text);
}
.wheel text {
  font-size: 14px;
  font-weight: 600;
  text-anchor: middle;
  dominant-baseline: middle;
}
.wheel text.strong {
  fill: var(--color-success);
}
.wheel text.weak {
  fill: var(--color-danger-text);
}

.content .legend {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px 18px;
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
}
.content .legend li {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: var(--reading-small-size);
  line-height: 1.4;
  color: var(--reading-muted);
  opacity: 1;
}
.swatch {
  width: 22px;
  border-top: 3px solid var(--color-success);
}
.swatch.weak {
  border-top: 3px dotted var(--color-danger-text);
}

@container (max-width: 760px) {
  .bonus {
    grid-auto-flow: row;
    grid-template-rows: none;
  }
  .tactics {
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
  }
  .guide-table th,
  .guide-table td {
    padding: 8px 4px;
  }
}
</style>
