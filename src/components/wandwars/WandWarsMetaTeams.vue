<template>
  <div class="meta-teams">
    <div v-if="totalMatches < 5" class="empty-state">
      Not enough data yet. Record more matches to see team analytics.
    </div>

    <template v-else>
      <!-- Hero Table (units) -->
      <section v-if="category === 'units'" class="section">
        <div class="hero-table-wrap">
          <table class="hero-table">
            <thead>
              <tr>
                <th class="col-hero">Hero</th>
                <th
                  :class="['col-sortable', { active: heroSort === 'matches' }]"
                  @click="heroSort = 'matches'"
                >
                  Usage
                </th>
                <th
                  :class="['col-sortable', { active: heroSort === 'winRate' }]"
                  @click="heroSort = 'winRate'"
                >
                  Win %
                </th>
                <th
                  ref="openerHeaderEl"
                  :class="['col-sortable', { active: heroSort === 'firstPick' }]"
                  @click="heroSort = 'firstPick'"
                  @mouseenter="showOpenerTooltip = true"
                  @mouseleave="showOpenerTooltip = false"
                >
                  Opener
                  <IconInfo :size="14" class="synergy-info-icon" />
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="hero in sortedHeroRows" :key="hero.name">
                <td class="col-hero">
                  <img
                    :src="characterImages[hero.name]"
                    :alt="hero.name"
                    :title="formatName(hero.name)"
                    class="table-portrait"
                  />
                  <span class="table-hero-name">{{ formatName(hero.name) }}</span>
                </td>
                <td class="col-num">{{ hero.matches }}</td>
                <td class="col-num">{{ formatPercent(hero.winRate) }}</td>
                <td class="col-num">{{ hero.firstPick }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Pair Table (synergy) -->
      <section v-if="category === 'synergy'" class="section">
        <div class="hero-table-wrap">
          <table class="hero-table">
            <thead>
              <tr>
                <th>Pair</th>
                <th
                  :class="['col-sortable', { active: pairSort === 'total' }]"
                  @click="pairSort = 'total'"
                >
                  Usage
                </th>
                <th
                  :class="['col-sortable', { active: pairSort === 'winRate' }]"
                  @click="pairSort = 'winRate'"
                >
                  Win %
                </th>
                <th class="col-static">Record</th>
                <th
                  ref="synergyHeaderEl"
                  :class="['col-sortable', { active: pairSort === 'synergy' }]"
                  @click="pairSort = 'synergy'"
                  @mouseenter="showSynergyTooltip = true"
                  @mouseleave="showSynergyTooltip = false"
                >
                  Synergy
                  <IconInfo :size="14" class="synergy-info-icon" />
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="pair in sortedPairRows" :key="pair.heroA + pair.heroB">
                <td class="col-hero">
                  <img
                    :src="characterImages[pair.heroA]"
                    :alt="pair.heroA"
                    :title="formatName(pair.heroA)"
                    class="table-portrait"
                  />
                  <img
                    :src="characterImages[pair.heroB]"
                    :alt="pair.heroB"
                    :title="formatName(pair.heroB)"
                    class="table-portrait"
                  />
                  <span class="table-hero-name">
                    {{ formatName(pair.heroA) }} + {{ formatName(pair.heroB) }}
                  </span>
                </td>
                <td class="col-num">{{ pair.total }}</td>
                <td class="col-num">{{ formatPercent(pair.winRate) }}</td>
                <td class="col-num">
                  <span class="wins">{{ pair.wins }}W</span> /
                  <span class="losses">{{ pair.losses }}L</span>
                </td>
                <td class="col-num" :style="{ color: synergyColor(pair.synergy), fontWeight: 600 }">
                  {{ formatSigned(pair.synergy) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Team Table (teams) -->
      <section v-if="category === 'teams'" class="section">
        <div class="hero-table-wrap">
          <table class="hero-table">
            <thead>
              <tr>
                <th>Team</th>
                <th
                  :class="['col-sortable', { active: teamSort === 'total' }]"
                  @click="teamSort = 'total'"
                >
                  Usage
                </th>
                <th
                  :class="['col-sortable', { active: teamSort === 'winRate' }]"
                  @click="teamSort = 'winRate'"
                >
                  Win %
                </th>
                <th class="col-static">Record</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="team in sortedTeamRows" :key="team.team.join(',')">
                <td class="col-hero">
                  <img
                    v-for="hero in team.team"
                    :key="hero"
                    :src="characterImages[hero]"
                    :alt="hero"
                    :title="formatName(hero)"
                    class="table-portrait"
                  />
                  <span class="table-hero-name">
                    {{ team.team.map(formatName).join(' + ') }}
                  </span>
                </td>
                <td class="col-num">{{ team.total }}</td>
                <td class="col-num">{{ formatPercent(team.winRate) }}</td>
                <td class="col-num">
                  <span class="wins">{{ team.wins }}W</span> /
                  <span class="losses">{{ team.losses }}L</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>

    <Teleport to="body">
      <TooltipPopup
        v-if="showOpenerTooltip && openerHeaderEl"
        :target-element="openerHeaderEl"
        variant="detailed"
        max-width="280px"
      >
        <template #content>
          <p style="margin: 0; font-size: 0.85rem; line-height: 1.4">
            Times picked as the very first hero in a match (left team, pick 1).
          </p>
        </template>
      </TooltipPopup>
      <TooltipPopup
        v-if="showSynergyTooltip && synergyHeaderEl"
        :target-element="synergyHeaderEl"
        variant="detailed"
        max-width="280px"
      >
        <template #content>
          <p style="margin: 0; font-size: 0.85rem; line-height: 1.4">
            Pair win rate minus average of each hero's individual win rate. Positive means they win
            more together than expected.
          </p>
        </template>
      </TooltipPopup>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import IconInfo from '@/components/ui/IconInfo.vue'
import TooltipPopup from '@/components/ui/TooltipPopup.vue'
import { computeTeamRecords } from '@/wandwars/analysis'
import { META_MIN_PAIR_MATCHES, META_MIN_TEAM_MATCHES } from '@/wandwars/constants'
import { formatName, formatPercent, formatSigned } from '@/wandwars/formatting'
import type { AnalysisData, MatchResult } from '@/wandwars/types'

const props = defineProps<{
  category: 'units' | 'teams' | 'synergy'
  matchData: MatchResult[]
  analysisData: AnalysisData
  characterImages: Record<string, string>
}>()

const totalMatches = computed(() => props.matchData.length)

const openerHeaderEl = ref<HTMLElement>()
const showOpenerTooltip = ref(false)
const synergyHeaderEl = ref<HTMLElement>()
const showSynergyTooltip = ref(false)

type HeroSortKey = 'matches' | 'winRate' | 'firstPick'
const heroSort = ref<HeroSortKey>('matches')

interface HeroRow {
  name: string
  matches: number
  winRate: number
  firstPick: number
}

const heroRows = computed(() => {
  const stats = props.analysisData.heroStats
  const firstPickCounts: Record<string, number> = {}

  for (const match of props.matchData) {
    const fp = match.left[0]
    if (fp) firstPickCounts[fp] = (firstPickCounts[fp] || 0) + 1
  }

  return props.analysisData.allHeroes.map((name): HeroRow => {
    const s = stats[name]
    return {
      name,
      matches: s?.matches ?? 0,
      winRate: s?.winRate ?? 0,
      firstPick: firstPickCounts[name] ?? 0,
    }
  })
})

const sortedHeroRows = computed(() =>
  [...heroRows.value].sort((a, b) => b[heroSort.value] - a[heroSort.value]),
)

type PairSortKey = 'total' | 'winRate' | 'synergy'
const pairSort = ref<PairSortKey>('synergy')

interface PairRow {
  heroA: string
  heroB: string
  wins: number
  losses: number
  total: number
  winRate: number
  synergy: number
}

const allPairRows = computed(() => {
  const matrix = props.analysisData.synergyMatrix
  const rows: PairRow[] = []
  const seen = new Set<string>()

  for (const [heroA, partners] of Object.entries(matrix)) {
    for (const [heroB, entry] of Object.entries(partners)) {
      const key = [heroA, heroB].sort().join(':')
      if (seen.has(key)) continue
      seen.add(key)
      if (entry.matches < META_MIN_PAIR_MATCHES) continue
      const wins = entry.wins
      const losses = entry.losses
      const total = entry.matches
      rows.push({
        heroA: heroA < heroB ? heroA : heroB,
        heroB: heroA < heroB ? heroB : heroA,
        wins,
        losses,
        total,
        winRate: total > 0 ? wins / total : 0,
        synergy: entry.score,
      })
    }
  }
  return rows
})

const sortedPairRows = computed(() =>
  [...allPairRows.value].sort((a, b) => {
    if (pairSort.value === 'synergy') return b.synergy - a.synergy || b.total - a.total
    return b[pairSort.value] - a[pairSort.value]
  }),
)

function synergyColor(value: number): string {
  if (value >= 0.1) return '#1e7e34'
  if (value <= -0.1) return '#c62828'
  return 'var(--color-text-secondary)'
}

const allTeamRecords = computed(() => computeTeamRecords(props.matchData))

type TeamSortKey = 'total' | 'winRate'
const teamSort = ref<TeamSortKey>('total')

const sortedTeamRows = computed(() =>
  allTeamRecords.value
    .filter((t) => t.total >= META_MIN_TEAM_MATCHES)
    .sort((a, b) => b[teamSort.value] - a[teamSort.value] || b.total - a.total),
)
</script>

<style scoped>
.meta-teams {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
}

.empty-state {
  text-align: center;
  color: var(--color-text-secondary);
  padding: var(--spacing-2xl);
  font-size: 1rem;
}

.section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  background: #ebebee;
  padding: var(--spacing-md);
  border-radius: var(--radius-medium);
}

.section-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--color-text-secondary);
  letter-spacing: 0.05em;
}

/* Hero table */
.hero-table-wrap {
  overflow-x: auto;
}

.hero-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.95rem;
}

.hero-table th {
  padding: var(--spacing-xs) var(--spacing-sm);
  font-weight: 600;
  color: var(--color-text-secondary);
  border-bottom: 2px solid var(--color-border-light);
  white-space: nowrap;
}

.hero-table th:first-child {
  text-align: left;
}

.hero-table td {
  padding: var(--spacing-xs) var(--spacing-sm);
  border-bottom: 1px solid var(--color-border-light);
}

.hero-table tbody tr:nth-child(odd) {
  background: var(--color-bg-white);
}

.hero-table tbody tr:nth-child(even) {
  background: #f6f6f8;
}

td.col-hero {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.col-sortable {
  cursor: pointer;
  user-select: none;
  text-align: center;
  transition: color var(--transition-fast);
}

.synergy-info-icon {
  vertical-align: middle;
  opacity: 0.5;
  margin-left: 2px;
}

.col-sortable:hover {
  color: var(--color-primary);
}

.col-sortable.active {
  color: var(--color-primary);
}

.col-num {
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.col-static {
  text-align: center;
}

.wins {
  color: #1e7e34;
  font-weight: 600;
}

.losses {
  color: #c62828;
  font-weight: 600;
}

.table-portrait {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  object-position: center 20%;
  border: 1px solid var(--color-border-light);
  flex-shrink: 0;
}

.table-hero-name {
  font-weight: 600;
  color: var(--color-text-primary);
}

@media (max-width: 1200px) {
  .section-title {
    font-size: 1.05rem;
  }

  .hero-table {
    font-size: 0.9rem;
  }

  .table-portrait {
    width: 40px;
    height: 40px;
  }
}
</style>
