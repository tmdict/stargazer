<template>
  <div class="insights-panel">
    <div v-if="totalMatches < 5" class="empty-state">
      Not enough data yet. Record more matches to see insights.
    </div>

    <template v-else>
      <div class="dataset-header">
        {{ totalMatches }} matches analyzed across {{ heroCount }} heroes. Auto-generated from match
        data. Results may reflect sampling bias.
      </div>

      <!-- Insights always at top -->
      <section v-if="filteredInsights.length > 0" class="section">
        <h3 class="section-title">Insights</h3>
        <div class="insights-list">
          <div
            v-for="(insight, i) in filteredInsights"
            :key="i"
            class="insight-card"
            v-html="formatInsightHtml(insight.text, characterImages)"
          />
        </div>
      </section>

      <!-- Best Openers (units only) -->
      <section v-if="category === 'units' && bestOpeners.length > 0" class="section">
        <h3
          ref="openerTitleEl"
          class="section-title"
          @mouseenter="showOpenerTooltip = true"
          @mouseleave="showOpenerTooltip = false"
        >
          Best Openers
          <IconInfo :size="14" class="section-info-icon" />
        </h3>
        <div class="counter-list">
          <div v-for="(o, i) in bestOpeners" :key="'op' + i" class="counter-row">
            <img
              :src="characterImages[o.hero]"
              :alt="o.hero"
              :title="formatName(o.hero)"
              class="hero-portrait"
            />
            <span class="counter-record">
              <span class="wins">{{ o.wins }}W</span> /
              <span class="losses">{{ o.losses }}L</span>
              <span class="win-rate">{{ (o.winRate * 10).toFixed(2) }}</span>
            </span>
          </div>
        </div>
      </section>

      <!-- Best Responses (units only) -->
      <section v-if="category === 'units' && bestResponses.length > 0" class="section">
        <h3
          ref="responseTitleEl"
          class="section-title"
          @mouseenter="showResponseTooltip = true"
          @mouseleave="showResponseTooltip = false"
        >
          Best Responses
          <IconInfo :size="14" class="section-info-icon" />
        </h3>
        <div class="counter-list">
          <div v-for="(r, i) in bestResponses" :key="'rp' + i" class="counter-row">
            <img
              :src="characterImages[r.responder]"
              :alt="r.responder"
              :title="formatName(r.responder)"
              class="hero-portrait"
            />
            <span class="response-label">
              <span>counters</span>
              <span class="response-arrow"></span>
            </span>
            <div class="response-targets">
              <div v-for="c in r.counters" :key="c.opener" class="response-target">
                <img
                  :src="characterImages[c.opener]"
                  :alt="c.opener"
                  :title="formatName(c.opener)"
                  class="hero-portrait"
                />
                <span class="response-target-record">
                  <span class="wins">{{ c.wins }}W</span> /
                  <span class="losses">{{ c.losses }}L</span>
                  <span class="win-rate-inline">{{ (c.winRate * 10).toFixed(2) }}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Synergy: Pair Counters -->
      <section v-if="category === 'synergy' && groupedPairCounters.length > 0" class="section">
        <h3
          ref="pairCounterTitleEl"
          class="section-title"
          @mouseenter="showPairCounterTooltip = true"
          @mouseleave="showPairCounterTooltip = false"
        >
          Pair Counters
          <IconInfo :size="14" class="section-info-icon" />
        </h3>
        <div class="counter-list">
          <div v-for="(g, i) in groupedPairCounters" :key="'pc' + i" class="counter-row">
            <div class="counter-group">
              <img
                v-for="hero in g.target"
                :key="hero"
                :src="characterImages[hero]"
                :alt="hero"
                :title="formatName(hero)"
                class="hero-portrait"
              />
            </div>
            <span class="response-label">
              <span>countered by</span>
              <span class="response-arrow reverse"></span>
            </span>
            <div class="response-targets">
              <div v-for="c in g.counters" :key="c.pair.join(',')" class="response-target">
                <div class="counter-group">
                  <img
                    v-for="hero in c.pair"
                    :key="hero"
                    :src="characterImages[hero]"
                    :alt="hero"
                    :title="formatName(hero)"
                    class="hero-portrait"
                  />
                </div>
                <span class="response-target-record">
                  <span class="wins">{{ c.wins }}W</span> /
                  <span class="losses">{{ c.losses }}L</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Most Dominant Pairs (synergy only) -->
      <section v-if="category === 'synergy' && sweepPairs.length > 0" class="section">
        <h3
          ref="dominantPairsTitleEl"
          class="section-title"
          @mouseenter="showDominantPairsTooltip = true"
          @mouseleave="showDominantPairsTooltip = false"
        >
          Most Dominant Pairs
          <IconInfo :size="14" class="section-info-icon" />
        </h3>
        <div class="counter-list">
          <div v-for="(s, i) in sweepPairs" :key="'sp' + i" class="counter-row">
            <div class="counter-group">
              <img
                v-for="hero in s.team"
                :key="hero"
                :src="characterImages[hero]"
                :alt="hero"
                :title="formatName(hero)"
                class="hero-portrait"
              />
            </div>
            <span class="counter-record"> {{ s.sweeps }} sweeps / {{ s.total }} wins </span>
          </div>
        </div>
      </section>

      <!-- Team Counters (teams only) -->
      <section v-if="category === 'teams' && groupedTeamCounters.length > 0" class="section">
        <h3
          ref="teamCountersTitleEl"
          class="section-title"
          @mouseenter="showTeamCountersTooltip = true"
          @mouseleave="showTeamCountersTooltip = false"
        >
          Team Counters
          <IconInfo :size="14" class="section-info-icon" />
        </h3>
        <div class="counter-list">
          <div v-for="(g, i) in groupedTeamCounters" :key="'tc' + i" class="counter-row">
            <div class="counter-group">
              <img
                v-for="hero in g.winner"
                :key="hero"
                :src="characterImages[hero]"
                :alt="hero"
                :title="formatName(hero)"
                class="hero-portrait"
              />
            </div>
            <span class="response-label">
              <span>counters</span>
              <span class="response-arrow"></span>
            </span>
            <div class="response-targets">
              <div v-for="c in g.countered" :key="c.team.join(',')" class="response-target">
                <div class="counter-group">
                  <img
                    v-for="hero in c.team"
                    :key="hero"
                    :src="characterImages[hero]"
                    :alt="hero"
                    :title="formatName(hero)"
                    class="hero-portrait"
                  />
                </div>
                <span class="response-target-record">
                  <span class="wins">{{ c.wins }}W</span> /
                  <span class="losses">{{ c.losses }}L</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
      <!-- Most Dominant Teams (teams only) -->
      <section v-if="category === 'teams' && sweepTeams.length > 0" class="section">
        <h3
          ref="dominantTeamsTitleEl"
          class="section-title"
          @mouseenter="showDominantTeamsTooltip = true"
          @mouseleave="showDominantTeamsTooltip = false"
        >
          Most Dominant Teams
          <IconInfo :size="14" class="section-info-icon" />
        </h3>
        <div class="counter-list">
          <div v-for="(s, i) in sweepTeams" :key="'st' + i" class="counter-row">
            <div class="counter-group">
              <img
                v-for="hero in s.team"
                :key="hero"
                :src="characterImages[hero]"
                :alt="hero"
                :title="formatName(hero)"
                class="hero-portrait"
              />
            </div>
            <span class="counter-record"> {{ s.sweeps }} sweeps / {{ s.total }} wins </span>
          </div>
        </div>
      </section>
    </template>

    <Teleport to="body">
      <TooltipPopup
        v-if="showOpenerTooltip && openerTitleEl"
        :target-element="openerTitleEl"
        variant="detailed"
        max-width="280px"
      >
        <template #content>
          <p style="margin: 0; font-size: 0.85rem; line-height: 1.4">
            Heroes with the highest win rate when picked first by the left team (pick 1 of the
            draft). Included when hero has ≥ 3 opening matches AND Bayesian-smoothed win rate ≥ 55%.
          </p>
        </template>
      </TooltipPopup>
      <TooltipPopup
        v-if="showResponseTooltip && responseTitleEl"
        :target-element="responseTitleEl"
        variant="detailed"
        max-width="280px"
      >
        <template #content>
          <p style="margin: 0; font-size: 0.85rem; line-height: 1.4">
            Best right-team first pick (pick 2) in response to a specific left-team opener. W/L is
            from the responder's perspective. Included when the matchup has ≥ 2 games AND the
            responder has more wins than losses.
          </p>
        </template>
      </TooltipPopup>
      <TooltipPopup
        v-if="showPairCounterTooltip && pairCounterTitleEl"
        :target-element="pairCounterTitleEl"
        variant="detailed"
        max-width="280px"
      >
        <template #content>
          <p style="margin: 0; font-size: 0.85rem; line-height: 1.4">
            Pairs that consistently beat another pair or full team when they share a match. Included
            when the winning pair has ≥ 2 wins AND more wins than losses. Pair-vs-pair entries
            additionally require wins across ≥ 2 distinct opposing full teams, so they aren't just
            slices of a single repeated 3v3 matchup.
          </p>
        </template>
      </TooltipPopup>
      <TooltipPopup
        v-if="showDominantPairsTooltip && dominantPairsTitleEl"
        :target-element="dominantPairsTitleEl"
        variant="detailed"
        max-width="280px"
      >
        <template #content>
          <p style="margin: 0; font-size: 0.85rem; line-height: 1.4">
            Pairs with the most dominant (sweep) wins. Included when the pair has ≥ 2 sweep wins.
          </p>
        </template>
      </TooltipPopup>
      <TooltipPopup
        v-if="showTeamCountersTooltip && teamCountersTitleEl"
        :target-element="teamCountersTitleEl"
        variant="detailed"
        max-width="280px"
      >
        <template #content>
          <p style="margin: 0; font-size: 0.85rem; line-height: 1.4">
            Team-vs-team matchups where one team decisively beats the other. Included when the
            winning team has ≥ 2 wins AND at least twice as many wins as losses in their
            head-to-head (e.g., 2-0, 4-1, 4-2 qualify; 3-2 does not).
          </p>
        </template>
      </TooltipPopup>
      <TooltipPopup
        v-if="showDominantTeamsTooltip && dominantTeamsTitleEl"
        :target-element="dominantTeamsTitleEl"
        variant="detailed"
        max-width="280px"
      >
        <template #content>
          <p style="margin: 0; font-size: 0.85rem; line-height: 1.4">
            Full 3-hero teams with the most dominant (sweep) wins. Included when the team has ≥ 2
            sweep wins.
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
import {
  META_BAYESIAN_PRIOR,
  META_MIN_PAIR_MATCHES,
  META_MIN_TEAM_MATCHES,
} from '@/wandwars/constants'
import { formatInsightHtml, formatName, formatPercent } from '@/wandwars/formatting'
import type { AnalysisData, MatchResult } from '@/wandwars/types'

type InsightCategory = 'units' | 'teams' | 'synergy'

interface Insight {
  text: string
  category: InsightCategory
}

const props = defineProps<{
  category: InsightCategory
  matchData: MatchResult[]
  analysisData: AnalysisData
  characterImages: Record<string, string>
}>()

const totalMatches = computed(() => props.matchData.length)
const heroCount = computed(() => props.analysisData.allHeroes.length)

const showOpenerTooltip = ref(false)
const openerTitleEl = ref<HTMLElement | null>(null)
const showResponseTooltip = ref(false)
const responseTitleEl = ref<HTMLElement | null>(null)
const showPairCounterTooltip = ref(false)
const pairCounterTitleEl = ref<HTMLElement | null>(null)
const showDominantPairsTooltip = ref(false)
const dominantPairsTitleEl = ref<HTMLElement | null>(null)
const showTeamCountersTooltip = ref(false)
const teamCountersTitleEl = ref<HTMLElement | null>(null)
const showDominantTeamsTooltip = ref(false)
const dominantTeamsTitleEl = ref<HTMLElement | null>(null)

const allTeamRecords = computed(() => computeTeamRecords(props.matchData))

const topWinningTeams = computed(() =>
  allTeamRecords.value
    .filter((t) => t.total >= META_MIN_TEAM_MATCHES && t.wins > t.losses)
    .sort((a, b) => b.winRate - a.winRate || b.total - a.total)
    .slice(0, 5),
)

interface PairRecord {
  heroA: string
  heroB: string
  wins: number
  losses: number
  total: number
  synergy: number
}

const strongestPairs = computed(() => {
  const pairs: PairRecord[] = []
  const matrix = props.analysisData.synergyMatrix

  const seen = new Set<string>()
  for (const [heroA, partners] of Object.entries(matrix)) {
    for (const [heroB, entry] of Object.entries(partners)) {
      const key = [heroA, heroB].sort().join(':')
      if (seen.has(key)) continue
      seen.add(key)
      if (entry.matches < META_MIN_PAIR_MATCHES) continue
      pairs.push({
        heroA: heroA < heroB ? heroA : heroB,
        heroB: heroA < heroB ? heroB : heroA,
        wins: entry.wins,
        losses: entry.losses,
        total: entry.matches,
        synergy: entry.score,
      })
    }
  }

  return pairs
    .filter((p) => p.wins > p.losses)
    .sort((a, b) => b.synergy - a.synergy || b.total - a.total)
    .slice(0, 8)
})

// Head-to-head team matchups
interface TeamH2H {
  a: [string, string, string]
  b: [string, string, string]
  aWins: number
  bWins: number
  total: number
}

const teamH2H = computed(() => {
  const map = new Map<string, TeamH2H>()
  for (const match of props.matchData) {
    if (match.result === 'draw') continue
    const lk = [...match.left].sort().join(',')
    const rk = [...match.right].sort().join(',')
    const [first, second] = lk < rk ? [lk, rk] : [rk, lk]
    const key = `${first}|${second}`
    if (!map.has(key)) {
      map.set(key, {
        a: (lk < rk ? [...match.left] : [...match.right]).sort() as [string, string, string],
        b: (lk < rk ? [...match.right] : [...match.left]).sort() as [string, string, string],
        aWins: 0,
        bWins: 0,
        total: 0,
      })
    }
    const rec = map.get(key)!
    rec.total++
    const winnerIsLeft = match.result === 'left'
    const leftIsA = lk < rk
    if ((winnerIsLeft && leftIsA) || (!winnerIsLeft && !leftIsA)) rec.aWins++
    else rec.bWins++
  }
  return [...map.values()]
})

// For each strong pair, count how many distinct opponent teams they beat
function getPairOpponentDiversity(
  heroA: string,
  heroB: string,
): { opponents: number; wins: number } {
  const oppTeams = new Set<string>()
  let wins = 0
  for (const match of props.matchData) {
    for (const [team, oppTeam, isWin] of [
      [match.left, match.right, match.result === 'left'],
      [match.right, match.left, match.result === 'right'],
    ] as const) {
      if (!isWin) continue
      const s = new Set(team)
      if (s.has(heroA) && s.has(heroB)) {
        oppTeams.add([...oppTeam].sort().join(','))
        wins++
      }
    }
  }
  return { opponents: oppTeams.size, wins }
}

// Draft position: best openers (left first pick win rate)
interface FirstPickStat {
  hero: string
  wins: number
  losses: number
  winRate: number
}

const bestOpeners = computed(() => {
  const stats = new Map<
    string,
    { wins: number; losses: number; weightedWins: number; weightedTotal: number }
  >()
  for (const match of props.matchData) {
    const hero = match.left[0]
    if (!stats.has(hero)) stats.set(hero, { wins: 0, losses: 0, weightedWins: 0, weightedTotal: 0 })
    const s = stats.get(hero)!
    if (match.result === 'left') {
      s.wins++
      s.weightedWins += match.weight
      s.weightedTotal += match.weight
    } else if (match.result === 'right') {
      s.losses++
      s.weightedTotal += match.weight
    }
  }
  const results: FirstPickStat[] = []
  for (const [hero, s] of stats) {
    const total = s.wins + s.losses
    if (total < 3) continue
    const winRate =
      (s.weightedWins + META_BAYESIAN_PRIOR) / (s.weightedTotal + 2 * META_BAYESIAN_PRIOR)
    if (winRate < 0.55) continue
    results.push({ hero, wins: s.wins, losses: s.losses, winRate })
  }
  return results.sort((a, b) => b.winRate - a.winRate || b.wins - a.wins)
})

// Draft position: best responses (right first pick given left first pick)
interface ResponseTarget {
  opener: string
  wins: number
  losses: number
  winRate: number
}

interface ResponderGroup {
  responder: string
  counters: ResponseTarget[]
  bestWinRate: number
}

const bestResponses = computed(() => {
  const stats = new Map<
    string,
    { wins: number; losses: number; weightedWins: number; weightedTotal: number }
  >()
  for (const match of props.matchData) {
    const key = `${match.left[0]}:${match.right[0]}`
    if (!stats.has(key)) stats.set(key, { wins: 0, losses: 0, weightedWins: 0, weightedTotal: 0 })
    const s = stats.get(key)!
    if (match.result === 'right') {
      s.wins++
      s.weightedWins += match.weight
      s.weightedTotal += match.weight
    } else if (match.result === 'left') {
      s.losses++
      s.weightedTotal += match.weight
    }
  }
  const byResponder = new Map<string, ResponseTarget[]>()
  for (const [key, s] of stats) {
    const [opener, responder] = key.split(':') as [string, string]
    const total = s.wins + s.losses
    if (total < 2) continue
    if (s.wins <= s.losses) continue
    const winRate =
      (s.weightedWins + META_BAYESIAN_PRIOR) / (s.weightedTotal + 2 * META_BAYESIAN_PRIOR)
    if (!byResponder.has(responder)) byResponder.set(responder, [])
    byResponder.get(responder)!.push({ opener, wins: s.wins, losses: s.losses, winRate })
  }
  const groups: ResponderGroup[] = []
  for (const [responder, counters] of byResponder) {
    counters.sort((a, b) => b.winRate - a.winRate || b.wins - a.wins)
    const best = counters[0]
    if (!best) continue
    groups.push({ responder, counters, bestWinRate: best.winRate })
  }
  return groups.sort((a, b) => b.bestWinRate - a.bestWinRate)
})

function getPairs(team: [string, string, string]): [string, string][] {
  return [
    [team[0], team[1]].sort() as [string, string],
    [team[0], team[2]].sort() as [string, string],
    [team[1], team[2]].sort() as [string, string],
  ]
}

interface PairCounter {
  pair: string[]
  countered: string[]
  wins: number
  losses: number
}

const allPairCounters = computed(() => {
  const results: PairCounter[] = []

  // Pair vs Pair.
  // Track the set of distinct full opponent teams each side beat — a pair-vs-pair
  // entry is only meaningful when the winning pair has beaten multiple different
  // full-team compositions. Otherwise, the entry is a redundant slice of a single
  // pair-vs-team result and just clutters the list.
  const pairMap = new Map<
    string,
    {
      a: [string, string]
      b: [string, string]
      aWins: number
      bWins: number
      total: number
      aOppTeams: Set<string>
      bOppTeams: Set<string>
    }
  >()

  for (const match of props.matchData) {
    if (match.result === 'draw') continue
    const leftPairs = getPairs(match.left)
    const rightPairs = getPairs(match.right)
    const leftTeamKey = [...match.left].sort().join(',')
    const rightTeamKey = [...match.right].sort().join(',')

    for (const lp of leftPairs) {
      for (const rp of rightPairs) {
        const lpKey = lp.join(',')
        const rpKey = rp.join(',')
        const [first, second] = lpKey < rpKey ? [lpKey, rpKey] : [rpKey, lpKey]
        const key = `${first}|${second}`

        if (!pairMap.has(key)) {
          pairMap.set(key, {
            a: lpKey < rpKey ? lp : rp,
            b: lpKey < rpKey ? rp : lp,
            aWins: 0,
            bWins: 0,
            total: 0,
            aOppTeams: new Set(),
            bOppTeams: new Set(),
          })
        }

        const rec = pairMap.get(key)!
        rec.total++
        const leftWon = match.result === 'left'
        const leftIsA = lpKey < rpKey
        if ((leftWon && leftIsA) || (!leftWon && !leftIsA)) {
          rec.aWins++
          rec.aOppTeams.add(leftIsA ? rightTeamKey : leftTeamKey)
        } else {
          rec.bWins++
          rec.bOppTeams.add(leftIsA ? leftTeamKey : rightTeamKey)
        }
      }
    }
  }

  for (const m of pairMap.values()) {
    if (m.total < 2) continue
    if (m.aWins > m.bWins && m.aWins >= 2 && m.aOppTeams.size >= 2) {
      results.push({ pair: m.a, countered: m.b, wins: m.aWins, losses: m.bWins })
    } else if (m.bWins > m.aWins && m.bWins >= 2 && m.bOppTeams.size >= 2) {
      results.push({ pair: m.b, countered: m.a, wins: m.bWins, losses: m.aWins })
    }
  }

  // Pair vs Team
  const teamMap = new Map<
    string,
    { pair: [string, string]; team: [string, string, string]; wins: number; losses: number }
  >()

  for (const match of props.matchData) {
    if (match.result === 'draw') continue
    const winner = match.result === 'left' ? match.left : match.right
    const loser = match.result === 'left' ? match.right : match.left
    const winnerPairs = getPairs(winner)
    const loserKey = [...loser].sort().join(',')

    for (const wp of winnerPairs) {
      const pairKey = wp.join(',')
      const key = `${pairKey}|${loserKey}`
      if (!teamMap.has(key)) {
        teamMap.set(key, {
          pair: wp,
          team: [...loser].sort() as [string, string, string],
          wins: 0,
          losses: 0,
        })
      }
      teamMap.get(key)!.wins++
    }

    const loserPairs = getPairs(loser)
    const winnerKey = [...winner].sort().join(',')
    for (const lp of loserPairs) {
      const pairKey = lp.join(',')
      const key = `${pairKey}|${winnerKey}`
      if (!teamMap.has(key)) {
        teamMap.set(key, {
          pair: lp,
          team: [...winner].sort() as [string, string, string],
          wins: 0,
          losses: 0,
        })
      }
      teamMap.get(key)!.losses++
    }
  }

  for (const m of teamMap.values()) {
    if (m.wins + m.losses < 2 || m.wins < 2) continue
    if (m.wins > m.losses) {
      results.push({ pair: m.pair, countered: m.team, wins: m.wins, losses: m.losses })
    }
  }

  return results.sort((a, b) => b.countered.length - a.countered.length || b.wins - a.wins)
})

interface PairCounterGroup {
  target: string[]
  counters: Array<{ pair: string[]; wins: number; losses: number }>
  totalWins: number
}

const groupedPairCounters = computed(() => {
  const groups = new Map<string, PairCounterGroup>()
  for (const entry of allPairCounters.value) {
    const key = [...entry.countered].sort().join(',')
    if (!groups.has(key)) {
      groups.set(key, { target: entry.countered, counters: [], totalWins: 0 })
    }
    const g = groups.get(key)!
    g.counters.push({ pair: entry.pair, wins: entry.wins, losses: entry.losses })
    g.totalWins += entry.wins
  }
  for (const g of groups.values()) {
    g.counters.sort((a, b) => b.wins - a.wins || a.losses - b.losses)
  }
  return [...groups.values()].sort(
    (a, b) =>
      b.target.length - a.target.length ||
      b.counters.length - a.counters.length ||
      b.totalWins - a.totalWins,
  )
})

interface TeamCounterMatchup {
  winner: [string, string, string]
  loser: [string, string, string]
  wins: number
  losses: number
}

const dominantTeamMatchups = computed(() => {
  const results: TeamCounterMatchup[] = []
  for (const m of teamH2H.value) {
    if (m.total < 2) continue
    if (m.aWins >= 2 * Math.max(m.bWins, 1) && m.aWins >= 2) {
      results.push({ winner: m.a, loser: m.b, wins: m.aWins, losses: m.bWins })
    } else if (m.bWins >= 2 * Math.max(m.aWins, 1) && m.bWins >= 2) {
      results.push({ winner: m.b, loser: m.a, wins: m.bWins, losses: m.aWins })
    }
  }
  return results.sort((a, b) => b.wins - a.wins)
})

interface TeamCounterGroup {
  winner: string[]
  countered: Array<{ team: string[]; wins: number; losses: number }>
  totalWins: number
}

const groupedTeamCounters = computed(() => {
  const groups = new Map<string, TeamCounterGroup>()
  for (const m of dominantTeamMatchups.value) {
    const key = [...m.winner].sort().join(',')
    if (!groups.has(key)) {
      groups.set(key, { winner: m.winner, countered: [], totalWins: 0 })
    }
    const g = groups.get(key)!
    g.countered.push({ team: m.loser, wins: m.wins, losses: m.losses })
    g.totalWins += m.wins
  }
  for (const g of groups.values()) {
    g.countered.sort((a, b) => b.wins - a.wins || a.losses - b.losses)
  }
  return [...groups.values()].sort(
    (a, b) => b.countered.length - a.countered.length || b.totalWins - a.totalWins,
  )
})

// Sweep stats: teams with most dominant wins
interface SweepRecord {
  team: string[]
  sweeps: number
  total: number
}

const sweepTeams = computed(() => {
  const stats = new Map<string, { team: string[]; sweeps: number; total: number }>()
  for (const match of props.matchData) {
    if (match.result === 'draw') continue
    const isSweep = match.weight > 1
    const winner = match.result === 'left' ? match.left : match.right
    const key = [...winner].sort().join(',')
    if (!stats.has(key)) stats.set(key, { team: [...winner].sort(), sweeps: 0, total: 0 })
    const s = stats.get(key)!
    s.total++
    if (isSweep) s.sweeps++
  }
  const results: SweepRecord[] = []
  for (const s of stats.values()) {
    if (s.sweeps >= 2) results.push(s)
  }
  return results.sort((a, b) => b.sweeps - a.sweeps || b.total - a.total)
})

const sweepPairs = computed(() => {
  const stats = new Map<string, { team: string[]; sweeps: number; total: number }>()
  for (const match of props.matchData) {
    if (match.result === 'draw') continue
    const isSweep = match.weight > 1
    const winner = match.result === 'left' ? match.left : match.right
    const pairs = getPairs(winner)
    for (const pair of pairs) {
      const key = pair.join(',')
      if (!stats.has(key)) stats.set(key, { team: pair, sweeps: 0, total: 0 })
      const s = stats.get(key)!
      s.total++
      if (isSweep) s.sweeps++
    }
  }
  const results: SweepRecord[] = []
  for (const s of stats.values()) {
    if (s.sweeps >= 2) results.push(s)
  }
  return results.sort((a, b) => b.sweeps - a.sweeps || b.total - a.total)
})

function add(result: Insight[], category: InsightCategory, text: string) {
  result.push({ text, category })
}

const insights = computed(() => {
  const result: Insight[] = []
  const stats = props.analysisData.heroStats
  const allHeroes = Object.values(stats)
  const matrix = props.analysisData.synergyMatrix
  const counterMatrix = props.analysisData.counterMatrix

  // --- Units ---

  const sortedByMatches = [...allHeroes].sort((a, b) => b.matches - a.matches)
  const topHero = sortedByMatches[0]
  if (topHero && topHero.matches >= 10) {
    add(
      result,
      'units',
      `{${topHero.name}} is the most picked hero (${topHero.matches} matches, ${formatPercent(topHero.winRate)} win rate)`,
    )
  }

  const reliableHeroes = [...allHeroes].filter((s) => s.matches >= 5)
  const bestHero = [...reliableHeroes].sort((a, b) => b.winRate - a.winRate)[0]
  if (bestHero && bestHero.name !== topHero?.name) {
    add(
      result,
      'units',
      `{${bestHero.name}} has the highest win rate at ${formatPercent(bestHero.winRate)} (${bestHero.matches} matches)`,
    )
  }

  const sortedByWinRate = [...reliableHeroes].sort((a, b) => a.winRate - b.winRate)
  const worstHero = sortedByWinRate[0]
  if (worstHero && worstHero.winRate < 0.45) {
    add(
      result,
      'units',
      `{${worstHero.name}} has the lowest win rate at ${formatPercent(worstHero.winRate)} (${worstHero.matches} matches)`,
    )
  }

  const heroTeamCounts: Record<string, number> = {}
  for (const team of allTeamRecords.value) {
    for (const hero of team.team) {
      heroTeamCounts[hero] = (heroTeamCounts[hero] || 0) + 1
    }
  }
  const mostVersatile = Object.entries(heroTeamCounts).sort(([, a], [, b]) => b - a)[0]
  if (mostVersatile && mostVersatile[1] >= 5) {
    add(
      result,
      'units',
      `{${mostVersatile[0]}} is the most versatile, appearing in ${mostVersatile[1]} different team compositions`,
    )
  }

  const avgMatches = allHeroes.reduce((sum, h) => sum + h.matches, 0) / allHeroes.length
  const hiddenGem = [...reliableHeroes]
    .filter((h) => h.matches < avgMatches * 0.7 && h.winRate > 0.55)
    .sort((a, b) => b.winRate - a.winRate)[0]
  if (hiddenGem) {
    add(
      result,
      'units',
      `{${hiddenGem.name}} is a hidden gem \u2014 ${formatPercent(hiddenGem.winRate)} win rate despite only ${hiddenGem.matches} matches`,
    )
  }

  const rivalrySeen = new Set<string>()
  let biggestRivalry: { a: string; b: string; matches: number } | null = null
  for (const [hero, opponents] of Object.entries(counterMatrix)) {
    for (const [opp, entry] of Object.entries(opponents)) {
      const key = [hero, opp].sort().join(':')
      if (rivalrySeen.has(key)) continue
      rivalrySeen.add(key)
      if (!biggestRivalry || entry.matches > biggestRivalry.matches) {
        const [a, b] = [hero, opp].sort()
        biggestRivalry = { a: a!, b: b!, matches: entry.matches }
      }
    }
  }
  if (biggestRivalry && biggestRivalry.matches >= 5) {
    add(
      result,
      'units',
      `{${biggestRivalry.a}} and {${biggestRivalry.b}} are the biggest rivals (faced each other ${biggestRivalry.matches} times)`,
    )
  }

  const mostBalanced = [...reliableHeroes]
    .filter((h) => h.matches >= 8)
    .sort((a, b) => Math.abs(a.winRate - 0.5) - Math.abs(b.winRate - 0.5))[0]
  if (mostBalanced && Math.abs(mostBalanced.winRate - 0.5) < 0.03) {
    add(
      result,
      'units',
      `{${mostBalanced.name}} is the most balanced hero (${formatPercent(mostBalanced.winRate)} win rate over ${mostBalanced.matches} matches)`,
    )
  }

  // Least picked hero
  const leastPicked = sortedByMatches[sortedByMatches.length - 1]
  if (leastPicked && leastPicked.matches >= 1 && leastPicked.name !== worstHero?.name) {
    add(
      result,
      'units',
      `{${leastPicked.name}} is the least picked hero (only ${leastPicked.matches} matches)`,
    )
  }

  // Second best/worst win rates
  const secondBest = [...reliableHeroes].sort((a, b) => b.winRate - a.winRate)[1]
  if (secondBest && secondBest.name !== topHero?.name && secondBest.winRate > 0.55) {
    add(
      result,
      'units',
      `{${secondBest.name}} has the second highest win rate at ${formatPercent(secondBest.winRate)} (${secondBest.matches} matches)`,
    )
  }

  // Most wins total
  const mostWins = [...allHeroes].sort((a, b) => b.wins - a.wins)[0]
  if (
    mostWins &&
    mostWins.wins >= 5 &&
    mostWins.name !== bestHero?.name &&
    mostWins.name !== topHero?.name
  ) {
    add(
      result,
      'units',
      `{${mostWins.name}} has the most total wins (${mostWins.wins} wins across ${mostWins.matches} matches)`,
    )
  }

  // Most losses total
  const mostLosses = [...allHeroes].sort((a, b) => b.losses - a.losses)[0]
  if (mostLosses && mostLosses.losses >= 5 && mostLosses.name !== worstHero?.name) {
    add(
      result,
      'units',
      `{${mostLosses.name}} has the most total losses (${mostLosses.losses} losses across ${mostLosses.matches} matches)`,
    )
  }

  // First pick favorites
  const firstPickCounts: Record<string, number> = {}
  for (const match of props.matchData) {
    const fp0 = match.left[0]
    const fp1 = match.right[0]
    if (fp0) firstPickCounts[fp0] = (firstPickCounts[fp0] || 0) + 1
    if (fp1) firstPickCounts[fp1] = (firstPickCounts[fp1] || 0) + 1
  }
  const topFirstPick = Object.entries(firstPickCounts).sort(([, a], [, b]) => b - a)[0]
  if (topFirstPick && topFirstPick[1] >= 3) {
    add(
      result,
      'units',
      `{${topFirstPick[0]}} is the most popular first pick (chosen first ${topFirstPick[1]} times)`,
    )
  }

  // Hero with most draws
  const mostDraws = [...allHeroes].filter((h) => h.draws > 0).sort((a, b) => b.draws - a.draws)[0]
  if (mostDraws && mostDraws.draws >= 2) {
    add(
      result,
      'units',
      `{${mostDraws.name}} is involved in the most draws (${mostDraws.draws} draws)`,
    )
  }

  // Most countered hero (appears most in losing side of counter matchups)
  const counterVictims: Record<string, number> = {}
  for (const [, opponents] of Object.entries(counterMatrix)) {
    for (const [opp, entry] of Object.entries(opponents)) {
      if (entry.matches >= 3 && entry.score > 0.1) {
        counterVictims[opp] = (counterVictims[opp] || 0) + 1
      }
    }
  }
  const mostCountered = Object.entries(counterVictims).sort(([, a], [, b]) => b - a)[0]
  if (mostCountered && mostCountered[1] >= 2) {
    add(
      result,
      'units',
      `{${mostCountered[0]}} is countered by the most heroes (${mostCountered[1]} strong counters against it)`,
    )
  }

  // Best counter hero (counters the most opponents)
  const counterPowers: Record<string, number> = {}
  for (const [hero, opponents] of Object.entries(counterMatrix)) {
    for (const [, entry] of Object.entries(opponents)) {
      if (entry.matches >= 3 && entry.score > 0.1) {
        counterPowers[hero] = (counterPowers[hero] || 0) + 1
      }
    }
  }
  const bestCounter = Object.entries(counterPowers).sort(([, a], [, b]) => b - a)[0]
  if (bestCounter && bestCounter[1] >= 2) {
    add(
      result,
      'units',
      `{${bestCounter[0]}} counters the most opponents (strong against ${bestCounter[1]} heroes)`,
    )
  }

  // Win rate improving heroes (high win rate but low picks — underrated)
  const underrated = [...reliableHeroes]
    .filter((h) => h.matches >= 3 && h.matches <= avgMatches * 0.5 && h.winRate > 0.5)
    .sort((a, b) => b.winRate - a.winRate)
  if (underrated.length >= 2 && underrated[1]!.name !== hiddenGem?.name) {
    const h = underrated[1]!
    add(
      result,
      'units',
      `{${h.name}} may be underrated \u2014 ${formatPercent(h.winRate)} win rate in ${h.matches} matches`,
    )
  }

  // Overrated hero (high picks, below average win rate)
  const overrated = [...reliableHeroes]
    .filter((h) => h.matches > avgMatches * 1.3 && h.winRate < 0.48)
    .sort((a, b) => a.winRate - b.winRate)[0]
  if (overrated && overrated.name !== worstHero?.name) {
    add(
      result,
      'units',
      `{${overrated.name}} may be overrated \u2014 picked often (${overrated.matches} matches) but only ${formatPercent(overrated.winRate)} win rate`,
    )
  }

  // --- Teams ---

  const topTeams = topWinningTeams.value
  if (topTeams.length >= 3) {
    const heroCounts: Record<string, number> = {}
    for (const team of topTeams) {
      for (const hero of team.team) {
        heroCounts[hero] = (heroCounts[hero] || 0) + 1
      }
    }
    const frequent = Object.entries(heroCounts)
      .filter(([, count]) => count >= 2)
      .sort(([, a], [, b]) => b - a)
    for (const [hero, count] of frequent) {
      add(
        result,
        'teams',
        `{${hero}} appears in ${count} of the top ${topTeams.length} winning teams`,
      )
    }
  }

  for (const team of allTeamRecords.value) {
    if (team.total >= 3 && team.losses === 0) {
      add(
        result,
        'teams',
        `{${team.team[0]}} + {${team.team[1]}} + {${team.team[2]}} is undefeated in ${team.total} matches`,
      )
    }
  }

  for (const team of allTeamRecords.value) {
    if (team.total >= 3 && team.wins === 0) {
      add(
        result,
        'teams',
        `{${team.team[0]}} + {${team.team[1]}} + {${team.team[2]}} is winless in ${team.total} matches`,
      )
    }
  }

  // Most played team
  const mostPlayed = [...allTeamRecords.value].sort((a, b) => b.total - a.total)[0]
  if (mostPlayed && mostPlayed.total >= 3) {
    add(
      result,
      'teams',
      `{${mostPlayed.team[0]}} + {${mostPlayed.team[1]}} + {${mostPlayed.team[2]}} is the most played team (${mostPlayed.total} matches, ${formatPercent(mostPlayed.winRate)} win rate)`,
    )
  }

  // Best win rate team
  const bestTeam = [...allTeamRecords.value]
    .filter((t) => t.total >= META_MIN_TEAM_MATCHES)
    .sort((a, b) => b.winRate - a.winRate)[0]
  if (bestTeam && bestTeam.total >= 2) {
    const key = bestTeam.team.join(',')
    const mpKey = mostPlayed?.team.join(',')
    if (key !== mpKey) {
      add(
        result,
        'teams',
        `{${bestTeam.team[0]}} + {${bestTeam.team[1]}} + {${bestTeam.team[2]}} has the best win rate (${formatPercent(bestTeam.winRate)}, ${bestTeam.wins}W/${bestTeam.losses}L)`,
      )
    }
  }

  // Worst win rate team
  const worstTeam = [...allTeamRecords.value]
    .filter((t) => t.total >= META_MIN_TEAM_MATCHES)
    .sort((a, b) => a.winRate - b.winRate)[0]
  if (worstTeam && worstTeam.total >= 2 && worstTeam.winRate < 0.4) {
    add(
      result,
      'teams',
      `{${worstTeam.team[0]}} + {${worstTeam.team[1]}} + {${worstTeam.team[2]}} has the worst win rate (${formatPercent(worstTeam.winRate)}, ${worstTeam.wins}W/${worstTeam.losses}L)`,
    )
  }

  // Teams with all draws
  for (const team of allTeamRecords.value) {
    if (team.total >= 2 && team.draws === team.total) {
      add(
        result,
        'teams',
        `{${team.team[0]}} + {${team.team[1]}} + {${team.team[2]}} has drawn all ${team.total} matches`,
      )
    }
  }

  // Total unique teams
  const uniqueTeams = allTeamRecords.value.length
  if (uniqueTeams >= 5) {
    add(
      result,
      'teams',
      `${uniqueTeams} unique team compositions have been played across ${totalMatches.value} matches`,
    )
  }

  // Teams with close records
  for (const team of allTeamRecords.value) {
    if (team.total >= 4 && Math.abs(team.wins - team.losses) <= 1 && team.wins >= 2) {
      add(
        result,
        'teams',
        `{${team.team[0]}} + {${team.team[1]}} + {${team.team[2]}} has the most even record (${team.wins}W/${team.losses}L in ${team.total} matches)`,
      )
      break
    }
  }

  // Hero that appears in the most losing teams
  const losingTeamHeroCounts: Record<string, number> = {}
  for (const team of allTeamRecords.value) {
    if (team.total >= 2 && team.winRate < 0.4) {
      for (const hero of team.team) {
        losingTeamHeroCounts[hero] = (losingTeamHeroCounts[hero] || 0) + 1
      }
    }
  }
  const mostInLosingTeams = Object.entries(losingTeamHeroCounts).sort(([, a], [, b]) => b - a)[0]
  if (mostInLosingTeams && mostInLosingTeams[1] >= 2) {
    add(
      result,
      'teams',
      `{${mostInLosingTeams[0]}} appears in ${mostInLosingTeams[1]} underperforming teams`,
    )
  }

  const drawCount = props.matchData.filter((m) => m.result === 'draw').length
  if (drawCount > 0) {
    const drawRate = drawCount / props.matchData.length
    add(
      result,
      'teams',
      `${drawCount} draws out of ${props.matchData.length} matches (${formatPercent(drawRate)} draw rate)`,
    )
  }

  // Most dominant team (most sweeps)
  const topSweepTeam = sweepTeams.value[0]
  if (topSweepTeam && topSweepTeam.sweeps >= 2) {
    const t = topSweepTeam.team
    add(
      result,
      'teams',
      `{${t[0]}} + {${t[1]}} + {${t[2]}} is the most dominant team (${topSweepTeam.sweeps} sweeps out of ${topSweepTeam.total} wins)`,
    )
  }

  // Total sweeps
  const totalSweeps = props.matchData.filter((m) => m.weight > 1 && m.result !== 'draw').length
  if (totalSweeps >= 3) {
    const sweepRate = totalSweeps / props.matchData.filter((m) => m.result !== 'draw').length
    add(
      result,
      'teams',
      `${totalSweeps} matches ended in a sweep (${formatPercent(sweepRate)} of decisive matches)`,
    )
  }

  // Left vs right win rate
  const leftWins = props.matchData.filter((m) => m.result === 'left').length
  const rightWins = props.matchData.filter((m) => m.result === 'right').length
  if (leftWins + rightWins >= 10) {
    const leftRate = leftWins / (leftWins + rightWins)
    if (Math.abs(leftRate - 0.5) > 0.05) {
      const favored = leftRate > 0.5 ? 'left' : 'right'
      add(
        result,
        'teams',
        `The ${favored} side wins more often (${leftWins} left vs ${rightWins} right wins)`,
      )
    }
  }

  // --- Synergy (capped at ~10 most impactful) ---

  const allSynergyPairs: {
    a: string
    b: string
    score: number
    wins: number
    losses: number
    matches: number
  }[] = []
  const seenPairs = new Set<string>()
  for (const [heroA, partners] of Object.entries(matrix)) {
    for (const [heroB, entry] of Object.entries(partners)) {
      const key = [heroA, heroB].sort().join(':')
      if (seenPairs.has(key)) continue
      seenPairs.add(key)
      if (entry.matches >= 3) {
        allSynergyPairs.push({
          a: heroA < heroB ? heroA : heroB,
          b: heroA < heroB ? heroB : heroA,
          score: entry.score,
          wins: entry.wins,
          losses: entry.losses,
          matches: entry.matches,
        })
      }
    }
  }

  // 1. Strongest synergy pair
  const topPair = strongestPairs.value[0]
  if (topPair && topPair.synergy > 0.05) {
    const diversity = getPairOpponentDiversity(topPair.heroA, topPair.heroB)
    if (diversity.wins >= 3 && diversity.opponents <= 1) {
      add(
        result,
        'synergy',
        `{${topPair.heroA}} + {${topPair.heroB}} look strong together (${topPair.wins}W/${topPair.losses}L), but all wins are against the same team \u2014 may be a counter matchup rather than true synergy`,
      )
    } else {
      add(
        result,
        'synergy',
        `{${topPair.heroA}} and {${topPair.heroB}} have the strongest synergy (+${(topPair.synergy * 100).toFixed(1)}%, ${topPair.wins}W/${topPair.losses}L together)`,
      )
    }
  }

  // 2. Weakest synergy pair
  const worstPair = [...allSynergyPairs].sort((a, b) => a.score - b.score)[0]
  if (worstPair && worstPair.score < -0.05) {
    add(
      result,
      'synergy',
      `{${worstPair.a}} and {${worstPair.b}} have the weakest synergy (${(worstPair.score * 100).toFixed(1)}%, ${worstPair.wins}W/${worstPair.losses}L together)`,
    )
  }

  // 3. Most played pair
  const mostPlayedPair = [...allSynergyPairs].sort((a, b) => b.matches - a.matches)[0]
  if (mostPlayedPair && mostPlayedPair.matches >= 4) {
    add(
      result,
      'synergy',
      `{${mostPlayedPair.a}} + {${mostPlayedPair.b}} is the most played pair (${mostPlayedPair.matches} matches, ${mostPlayedPair.wins}W/${mostPlayedPair.losses}L)`,
    )
  }

  // 4. Best team player (hero in most strong pairs)
  const heroPairCounts: Record<string, number> = {}
  for (const pair of strongestPairs.value) {
    heroPairCounts[pair.heroA] = (heroPairCounts[pair.heroA] || 0) + 1
    heroPairCounts[pair.heroB] = (heroPairCounts[pair.heroB] || 0) + 1
  }
  const bestPairHero = Object.entries(heroPairCounts).sort(([, a], [, b]) => b - a)[0]
  if (bestPairHero && bestPairHero[1] >= 2) {
    add(
      result,
      'synergy',
      `{${bestPairHero[0]}} appears in ${bestPairHero[1]} of the strongest pairs \u2014 a strong team player`,
    )
  }

  // 5. Worst team player (hero in most weak pairs)
  const heroWeakPairCounts: Record<string, number> = {}
  for (const pair of allSynergyPairs) {
    if (pair.score < -0.03) {
      heroWeakPairCounts[pair.a] = (heroWeakPairCounts[pair.a] || 0) + 1
      heroWeakPairCounts[pair.b] = (heroWeakPairCounts[pair.b] || 0) + 1
    }
  }
  const worstPairHero = Object.entries(heroWeakPairCounts).sort(([, a], [, b]) => b - a)[0]
  if (worstPairHero && worstPairHero[1] >= 2) {
    add(
      result,
      'synergy',
      `{${worstPairHero[0]}} appears in ${worstPairHero[1]} weak pairings \u2014 may clash with teammates`,
    )
  }

  // 6. Pair with best opponent diversity
  for (const pair of strongestPairs.value.slice(0, 5)) {
    const diversity = getPairOpponentDiversity(pair.heroA, pair.heroB)
    if (diversity.opponents >= 3) {
      add(
        result,
        'synergy',
        `{${pair.heroA}} + {${pair.heroB}} have beaten ${diversity.opponents} different teams \u2014 a reliable combo`,
      )
      break
    }
  }

  // 7. Concentrated synergy warning (cap at 1)
  for (const pair of strongestPairs.value.slice(1, 6)) {
    if (pair.synergy <= 0.03) continue
    const diversity = getPairOpponentDiversity(pair.heroA, pair.heroB)
    if (diversity.wins >= 3 && diversity.opponents <= 1) {
      add(
        result,
        'synergy',
        `{${pair.heroA}} + {${pair.heroB}}'s wins are all against the same opponent \u2014 synergy may be overstated`,
      )
      break
    }
  }

  // 8-9. Undefeated pairs (cap at 2)
  const undefeatedPairs = allSynergyPairs
    .filter((p) => p.matches >= 3 && p.losses === 0)
    .sort((a, b) => b.matches - a.matches)
    .slice(0, 2)
  for (const pair of undefeatedPairs) {
    add(
      result,
      'synergy',
      `{${pair.a}} + {${pair.b}} are undefeated together (${pair.wins}W in ${pair.matches} matches)`,
    )
  }

  // 10. Winless pair (cap at 1)
  const winlessPair = allSynergyPairs
    .filter((p) => p.matches >= 3 && p.wins === 0)
    .sort((a, b) => b.matches - a.matches)[0]
  if (winlessPair) {
    add(
      result,
      'synergy',
      `{${winlessPair.a}} + {${winlessPair.b}} are winless together (${winlessPair.losses}L in ${winlessPair.matches} matches)`,
    )
  }

  // 11. Most dominant pair (most sweeps)
  const topSweepPair = sweepPairs.value[0]
  if (topSweepPair && topSweepPair.sweeps >= 2) {
    const p = topSweepPair.team
    add(
      result,
      'synergy',
      `{${p[0]}} + {${p[1]}} is the most dominant pair (${topSweepPair.sweeps} sweeps out of ${topSweepPair.total} wins)`,
    )
  }

  // --- Units: sweep insights ---

  // Hero with most sweeps
  const heroSweeps: Record<string, number> = {}
  for (const match of props.matchData) {
    if (match.result === 'draw' || match.weight <= 1) continue
    const winner = match.result === 'left' ? match.left : match.right
    for (const hero of winner) {
      heroSweeps[hero] = (heroSweeps[hero] || 0) + 1
    }
  }
  const topSweepHero = Object.entries(heroSweeps).sort(([, a], [, b]) => b - a)[0]
  if (topSweepHero && topSweepHero[1] >= 3) {
    add(
      result,
      'units',
      `{${topSweepHero[0]}} is involved in the most sweeps (${topSweepHero[1]} dominant wins)`,
    )
  }

  return result
})

const filteredInsights = computed(() => insights.value.filter((i) => i.category === props.category))
</script>

<style scoped>
.insights-panel {
  background: var(--color-bg-white);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-large);
  padding: var(--spacing-lg);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.empty-state {
  text-align: center;
  color: var(--color-text-secondary);
  padding: var(--spacing-2xl);
  font-size: 1rem;
}

.insights-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.insight-card {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
  padding: var(--spacing-md);
  border-left: 3px solid var(--color-primary);
  border-radius: var(--radius-small);
  background: var(--color-bg-white);
  font-size: 0.95rem;
  color: var(--color-text-primary);
  line-height: 40px;
}

.insight-card :deep(.insight-hero-img) {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  object-position: center 20%;
  vertical-align: middle;
  border: 1px solid var(--color-border-primary);
}

.insight-card :deep(.insight-hero-name) {
  font-weight: 600;
  color: var(--color-text-primary);
}

/* Sections */
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
  display: flex;
  align-items: center;
}

.section-info-icon {
  opacity: 0.5;
  margin-left: 4px;
  cursor: pointer;
}

.response-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  line-height: 1.1;
  text-align: center;
  margin: 0 var(--spacing-sm);
  gap: 4px;
}

.response-arrow {
  display: flex;
  align-items: center;
}

.response-arrow::before {
  content: '';
  display: block;
  width: 28px;
  height: 4px;
  background: var(--color-primary);
}

.response-arrow::after {
  content: '';
  display: block;
  width: 0;
  height: 0;
  border: 8px solid transparent;
  border-left: 10px solid var(--color-primary);
}

.response-arrow.reverse {
  flex-direction: row-reverse;
}

.response-arrow.reverse::after {
  border-left: 8px solid transparent;
  border-right: 10px solid var(--color-primary);
}

/* Counter rows (shared by hero, pair, team counters) */
.counter-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.counter-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-medium);
  background: var(--color-bg-white);
}

.counter-group {
  display: flex;
  gap: 4px;
}

.hero-portrait {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  object-position: center 20%;
  border: 2px solid var(--color-border-primary);
  flex-shrink: 0;
}

.counter-record {
  font-size: 0.9rem;
  color: var(--color-text-secondary);
  white-space: nowrap;
  margin-left: var(--spacing-md);
}

.vs-arrow {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.vs-arrow::before {
  content: '';
  display: block;
  width: 28px;
  height: 4px;
  background: var(--color-primary);
}

.vs-arrow::after {
  content: '';
  display: block;
  width: 0;
  height: 0;
  border: 8px solid transparent;
  border-left: 10px solid var(--color-primary);
}

.wins {
  color: #1e7e34;
  font-weight: 600;
}

.losses {
  color: #c62828;
  font-weight: 600;
}

.win-rate {
  color: var(--color-text-secondary);
  margin-left: var(--spacing-md);
}

.response-targets {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-md) var(--spacing-xl);
  padding-left: var(--spacing-sm);
}

.response-target {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.response-target-record {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.response-target-record .win-rate-inline {
  display: block;
  text-align: center;
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  margin-top: 1px;
}

.dataset-header {
  text-align: center;
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  font-style: italic;
  padding-bottom: var(--spacing-md);
}

@media (max-width: 1200px) {
  .section-title {
    font-size: 1.05rem;
  }

  .hero-portrait {
    width: 40px;
    height: 40px;
  }

  .counter-record {
    font-size: 0.85rem;
  }

  .response-label {
    font-size: 0.65rem;
  }
}
</style>
