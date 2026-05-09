<script setup lang="ts">
import { computed, ref } from 'vue'

import IconInfo from '@/components/ui/IconInfo.vue'
import TooltipPopup from '@/components/ui/TooltipPopup.vue'
import type { CharacterType } from '@/lib/types/character'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import {
  INSIGHT_NOTABLE_WINRATE,
  META_BAYESIAN_PRIOR,
  metaMinPairCounterWins,
  metaMinPairSweeps,
} from '@/wandwars/constants'
import { formatInsightHtml, formatName, joinLocale } from '@/wandwars/formatting'
import { buildInsights, type InsightCategory, type SweepRecord } from '@/wandwars/insights'
import { computeTeamRecords } from '@/wandwars/prediction/analysis'
import type { AnalysisData, MatchResult } from '@/wandwars/types'

const props = defineProps<{
  category: InsightCategory
  matchData: MatchResult[]
  analysisData: AnalysisData
  characterImages: Record<string, string>
}>()

const gameDataStore = useGameDataStore()
const i18n = useI18nStore()
const heroAttrMap = computed(() => {
  const map: Record<string, CharacterType> = {}
  for (const c of gameDataStore.characters) map[c.name] = c
  return map
})

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
    if (winRate < INSIGHT_NOTABLE_WINRATE) continue
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

  const minWins = metaMinPairCounterWins(totalMatches.value)
  for (const m of pairMap.values()) {
    if (m.total < 2) continue
    if (m.aWins > m.bWins && m.aWins >= minWins && m.aOppTeams.size >= 2) {
      results.push({ pair: m.a, countered: m.b, wins: m.aWins, losses: m.bWins })
    } else if (m.bWins > m.aWins && m.bWins >= minWins && m.bOppTeams.size >= 2) {
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
    if (m.wins + m.losses < 2 || m.wins < minWins) continue
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
  const minSweeps = metaMinPairSweeps(totalMatches.value)
  const results: SweepRecord[] = []
  for (const s of stats.values()) {
    if (s.sweeps >= minSweeps) results.push(s)
  }
  return results.sort((a, b) => b.sweeps - a.sweeps || b.total - a.total)
})

// Only the active category's builder runs; switching tabs swaps the builder
// rather than recomputing units + teams + synergy together.
const filteredInsights = computed(() =>
  buildInsights(props.category, {
    matchData: props.matchData,
    analysisData: props.analysisData,
    teamRecords: allTeamRecords.value,
    topSweepTeam: sweepTeams.value[0],
    topSweepPair: sweepPairs.value[0],
    heroAttrMap: heroAttrMap.value,
    t: i18n.t,
  }),
)
</script>

<template>
  <div class="insights-panel ww-card">
    <div v-if="totalMatches < 5" class="empty-state">
      {{ i18n.t('wandwars.messages/not-enough-data-insights') }}
    </div>

    <template v-else>
      <div class="dataset-header">
        {{
          i18n.t('wandwars.messages/dataset-header', {
            matches: totalMatches,
            heroes: heroCount,
          })
        }}
      </div>

      <!-- Insights always at top -->
      <section v-if="filteredInsights.length > 0" class="ww-section">
        <h3 class="ww-section-title">{{ i18n.t('wandwars.insights') }}</h3>
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
      <section v-if="category === 'units' && bestOpeners.length > 0" class="ww-section">
        <h3
          ref="openerTitleEl"
          class="ww-section-title"
          @mouseenter="showOpenerTooltip = true"
          @mouseleave="showOpenerTooltip = false"
        >
          {{ i18n.t('wandwars.best-openers') }}
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
      <section v-if="category === 'units' && bestResponses.length > 0" class="ww-section">
        <h3
          ref="responseTitleEl"
          class="ww-section-title"
          @mouseenter="showResponseTooltip = true"
          @mouseleave="showResponseTooltip = false"
        >
          {{ i18n.t('wandwars.best-responses') }}
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
              <span>{{ i18n.t('wandwars.counters') }}</span>
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
      <section v-if="category === 'synergy' && groupedPairCounters.length > 0" class="ww-section">
        <h3
          ref="pairCounterTitleEl"
          class="ww-section-title"
          @mouseenter="showPairCounterTooltip = true"
          @mouseleave="showPairCounterTooltip = false"
        >
          {{ joinLocale(i18n.t('wandwars.pair'), i18n.t('wandwars.counters')) }}
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
              <span>{{ i18n.t('wandwars.countered-by') }}</span>
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
      <section v-if="category === 'synergy' && sweepPairs.length > 0" class="ww-section">
        <h3
          ref="dominantPairsTitleEl"
          class="ww-section-title"
          @mouseenter="showDominantPairsTooltip = true"
          @mouseleave="showDominantPairsTooltip = false"
        >
          {{ i18n.t('wandwars.most-dominant-pairs') }}
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
            <span class="counter-record">
              {{ s.sweeps }} {{ i18n.t('wandwars.sweeps') }} / {{ s.total }}
              {{ i18n.t('wandwars.wins') }}
            </span>
          </div>
        </div>
      </section>

      <!-- Team Counters (teams only) -->
      <section v-if="category === 'teams' && groupedTeamCounters.length > 0" class="ww-section">
        <h3
          ref="teamCountersTitleEl"
          class="ww-section-title"
          @mouseenter="showTeamCountersTooltip = true"
          @mouseleave="showTeamCountersTooltip = false"
        >
          {{ joinLocale(i18n.t('wandwars.team'), i18n.t('wandwars.counters')) }}
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
              <span>{{ i18n.t('wandwars.counters') }}</span>
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
      <section v-if="category === 'teams' && sweepTeams.length > 0" class="ww-section">
        <h3
          ref="dominantTeamsTitleEl"
          class="ww-section-title"
          @mouseenter="showDominantTeamsTooltip = true"
          @mouseleave="showDominantTeamsTooltip = false"
        >
          {{ i18n.t('wandwars.most-dominant-teams') }}
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
            <span class="counter-record">
              {{ s.sweeps }} {{ i18n.t('wandwars.sweeps') }} / {{ s.total }}
              {{ i18n.t('wandwars.wins') }}
            </span>
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
          <p class="ww-tooltip-text">
            {{ i18n.t('wandwars.messages/tooltip-best-openers') }}
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
          <p class="ww-tooltip-text">
            {{ i18n.t('wandwars.messages/tooltip-best-responses') }}
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
          <p class="ww-tooltip-text">
            {{ i18n.t('wandwars.messages/tooltip-pair-counters') }}
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
          <p class="ww-tooltip-text">
            {{ i18n.t('wandwars.messages/tooltip-dominant-pairs') }}
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
          <p class="ww-tooltip-text">
            {{ i18n.t('wandwars.messages/tooltip-team-counters') }}
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
          <p class="ww-tooltip-text">
            {{ i18n.t('wandwars.messages/tooltip-dominant-teams') }}
          </p>
        </template>
      </TooltipPopup>
    </Teleport>
  </div>
</template>

<style scoped>
.insights-panel {
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

.section-info-icon {
  opacity: 0.5;
  margin-left: 4px;
  cursor: help;
  transition: opacity var(--transition-fast);
}

.section-info-icon:hover {
  opacity: 1;
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
  color: var(--color-success);
  font-weight: 600;
}

.losses {
  color: var(--color-error);
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

@media (max-width: 1280px) {
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
