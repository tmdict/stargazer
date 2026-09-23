<script setup lang="ts">
/* The counter ladder of a finished season: team rows by rating, a rule where
   the tier changes, and a curve per recorded counter carrying the winner's
   share of the games, drawn from layoutLadder. Selecting a team keeps only
   its curves lit, teal where it wins and red where it loses; curves link to
   the report's evidence. */

import { computed, onMounted, onUnmounted, ref } from 'vue'

import GuidePortrait from '@/components/guide/GuidePortrait.vue'
import IconChevronRight from '@/components/ui/IconChevronRight.vue'
import { layoutLadder, type LadderEdge } from '@/lib/pvp/ladderLayout'
import { pvpReportHref } from '@/lib/pvp/summary'
import type { AppLocale } from '@/lib/types/i18n'
import type { PvpCounter, PvpSeasonSummary, PvpTeam } from '@/lib/types/pvp'
import { interpolate } from '@/utils/interpolate'
import { appLabel } from '@/utils/skillLabels'

const props = defineProps<{ summary: PvpSeasonSummary; lang: AppLocale }>()

const label = (key: string): string => appLabel(key, props.lang)

const shareText = (counter: PvpCounter): string =>
  interpolate(label('ladder-share'), {
    rate: Math.round((100 * counter.wins) / (counter.wins + counter.losses)),
    games: counter.wins + counter.losses,
  })
const layout = computed(() => layoutLadder(props.summary, shareText))
// Every row reserves the widest strip, so the names line up down the column.
const portraitSlots = computed(() =>
  Math.max(...props.summary.teams.map((team) => team.heroes.length)),
)
const reportHref = computed(() => pvpReportHref(props.summary.season))

const teamName = (id: string): string => props.summary.teams.find((t) => t.id === id)?.name ?? id
// Zero-width spaces let a long label wrap at its slashes.
const ZERO_WIDTH_SPACE = String.fromCodePoint(0x200b)
const wrappable = (name: string): string => name.replaceAll('/', `/${ZERO_WIDTH_SPACE}`)
const edgeText = (counter: PvpCounter): string =>
  interpolate(label('ladder-edge'), {
    winner: teamName(counter.winner),
    loser: teamName(counter.loser),
    wins: counter.wins,
    losses: counter.losses,
  })

const selected = ref<string | null>(null)
const touches = (counter: PvpCounter, id: string): boolean =>
  counter.winner === id || counter.loser === id
// The selection and every team sharing a curve with it stay lit.
const related = computed(() => {
  const id = selected.value
  if (id === null) return null
  const ids = new Set([id])
  for (const counter of props.summary.counters) {
    if (touches(counter, id)) ids.add(counter.winner).add(counter.loser)
  }
  return ids
})
const edgeState = (edge: LadderEdge) => ({
  dim: selected.value !== null && !touches(edge.counter, selected.value),
  in: selected.value !== null && edge.counter.loser === selected.value,
})
const rowDim = (team: PvpTeam): boolean => related.value !== null && !related.value.has(team.id)
const toggle = (id: string) => {
  selected.value = selected.value === id ? null : id
}
const status = computed(() =>
  selected.value === null
    ? label('ladder-status-all')
    : interpolate(label('ladder-status-selected'), { team: teamName(selected.value) }),
)

// A click or tap anywhere but a team card, or Escape, shows every curve
// again. pointerup rather than click: iOS Safari can skip the click on plain
// text, and a touch that scrolls ends in pointercancel, so scrolling keeps
// the selection.
const clearOutside = (event: PointerEvent) => {
  if (selected.value !== null && !(event.target as Element | null)?.closest('.node')) {
    selected.value = null
  }
}
const clearOnEscape = (event: KeyboardEvent) => {
  if (event.key === 'Escape') selected.value = null
}
onMounted(() => {
  document.addEventListener('pointerup', clearOutside)
  document.addEventListener('keydown', clearOnEscape)
})
onUnmounted(() => {
  document.removeEventListener('pointerup', clearOutside)
  document.removeEventListener('keydown', clearOnEscape)
})
</script>

<template>
  <article class="container guide-panel">
    <div class="content guide-link">
      <a class="guide-title" :href="`${reportHref}#counter-ladder`">
        <h2>{{ label('counter-ladder') }}</h2>
        <IconChevronRight :size="18" />
      </a>

      <div class="key">
        <span>{{ label('ladder-key-up') }}</span>
        <span>{{ label('ladder-key-down') }}</span>
        <span class="break"></span>
        <span><i class="s3"></i>{{ label('ladder-key-strong') }}</span>
        <span><i class="s2"></i>{{ label('ladder-key-good') }}</span>
        <span><i class="s1"></i>{{ label('ladder-key-weak') }}</span>
        <span><i class="s0"></i>{{ label('ladder-key-possible') }}</span>
        <span><i class="in"></i>{{ label('ladder-key-selected') }}</span>
      </div>

      <div
        class="graph"
        :style="{
          '--rows': layout.rows.length,
          '--portraits': portraitSlots,
          '--offset': `${layout.offset}%`,
          '--column-left': `${layout.column.left}%`,
          '--column-width': `${layout.column.width}%`,
        }"
        role="group"
        :aria-label="label('counter-ladder')"
      >
        <svg :viewBox="`0 0 ${layout.width} ${layout.height}`" preserveAspectRatio="none">
          <a
            v-for="edge in layout.edges"
            :key="edge.counter.anchor"
            class="edge"
            :class="[`s${edge.counter.band}`, edgeState(edge)]"
            :href="`${reportHref}#${edge.counter.anchor}`"
            :aria-label="edgeText(edge.counter)"
          >
            <title>{{ edgeText(edge.counter) }}</title>
            <path class="hit" :d="edge.path" vector-effect="non-scaling-stroke" />
            <path class="line" :d="edge.path" vector-effect="non-scaling-stroke" />
          </a>
        </svg>

        <span
          v-for="edge in layout.edges"
          :key="`point-${edge.counter.anchor}`"
          class="point"
          :class="[edge.side, `s${edge.counter.band}`, edgeState(edge)]"
          :style="{ left: `${edge.arrow.left}%`, top: `${edge.arrow.top}%` }"
          aria-hidden="true"
        ></span>
        <span
          v-for="edge in layout.edges"
          :key="`share-${edge.counter.anchor}`"
          class="share"
          :class="[edgeState(edge), { few: edge.few }]"
          :style="{ left: `${edge.label.left}%`, top: `${edge.label.top}%` }"
          aria-hidden="true"
          >{{ edge.label.text }}</span
        >

        <div
          v-for="tier in layout.tiers"
          :key="tier.tier"
          class="tier"
          :style="{ top: `${tier.top}%` }"
        >
          <span :class="`t${tier.tier}`">{{ interpolate(label('tier'), { n: tier.tier }) }}</span>
        </div>

        <button
          v-for="row in layout.rows"
          :key="row.team.id"
          type="button"
          class="node"
          :class="{ dim: rowDim(row.team) }"
          :style="{ top: `${row.top}%` }"
          :aria-pressed="selected === row.team.id"
          :aria-label="interpolate(label('ladder-highlight'), { team: row.team.name })"
          @click="toggle(row.team.id)"
        >
          <span class="portraits">
            <GuidePortrait v-for="slug in row.team.heroes" :key="slug" :slug :lang />
          </span>
          <span class="name">
            <span>{{ wrappable(row.team.name) }}</span>
            <small>{{ label('rating') }} {{ row.team.rating.toFixed(2) }}</small>
          </span>
        </button>
      </div>

      <p class="status" aria-live="polite">{{ status }}</p>
    </div>
  </article>
</template>

<style scoped>
.content {
  --row: 96px;
  --portrait: 30px;
  --portrait-gap: 6px;
  --strong: var(--color-accent);
  --weak: rgba(255, 255, 255, 0.42);
  --in: #e07070;
}

/* Two deliberate rows: reading direction, then line strengths. */
.key {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 11px;
  margin-top: 10px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}
.key .break {
  flex-basis: 100%;
  height: 0;
}
.key i {
  display: inline-block;
  width: 18px;
  height: 0;
  margin-right: 5px;
  border-top: 3px solid var(--strong);
  vertical-align: middle;
}
.key i.s2 {
  border-top-style: dashed;
}
.key i.s1 {
  border-color: var(--weak);
  border-top-width: 2px;
}
.key i.s0 {
  border-color: var(--weak);
  border-top-style: dashed;
  border-top-width: 2px;
}
.key i.in {
  border-color: var(--in);
}

.graph {
  position: relative;
  height: calc(var(--rows) * var(--row));
  max-width: 780px;
  margin: 22px auto 0;
  /* Centred on the drawing's extremes, not the node column (see layout). */
  transform: translateX(var(--offset));
}
/* Above the panel's stretched title link so the curves stay clickable, but
   transparent to the pointer everywhere else, so empty graph space still
   opens the report's ladder. */
.graph > svg {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}

.node {
  position: absolute;
  left: var(--column-left);
  width: var(--column-width);
  transform: translateY(-50%);
  min-height: 64px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 8px;
  background: #2d2d2d;
  color: #fff;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    opacity 0.15s,
    border-color 0.15s;
  z-index: 2;
}
.node:hover,
.node[aria-pressed='true'] {
  border-color: var(--color-accent);
}
.node:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 3px;
}
.portraits {
  display: inline-flex;
  gap: var(--portrait-gap);
  flex: none;
  width: calc(var(--portraits) * var(--portrait) + (var(--portraits) - 1) * var(--portrait-gap));
}
.portraits .disc {
  --size: var(--portrait);
}
.name {
  min-width: 0;
  font-size: 14px;
  line-height: 1.3;
  font-weight: 600;
}
.name > span,
.name > small {
  display: block;
}
.name > small {
  font-size: 12px;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.5);
}

.edge {
  transition: opacity 0.15s;
}
.hit {
  stroke: transparent;
  stroke-width: 22px;
  fill: none;
  pointer-events: stroke;
}
.line {
  stroke: currentColor;
  stroke-width: 2.2px;
  stroke-linecap: round;
  fill: none;
  pointer-events: none;
}
.edge.s3,
.edge.s2 {
  color: var(--strong);
}
.edge.s3 .line {
  stroke-width: 3px;
}
.edge.s2 .line {
  stroke-width: 2.4px;
  stroke-dasharray: 6 4;
}
.edge.s1,
.edge.s0 {
  color: var(--weak);
}
.edge.s1 .line {
  stroke-width: 2px;
}
.edge.s0 .line {
  stroke-width: 1.5px;
  stroke-dasharray: 5 4;
}
.edge.in {
  color: var(--in);
}
.edge:hover .line,
.edge:focus-visible .line {
  stroke-width: 5px;
}

/* Arrowheads: a curve on the left side arrives at the loser's left edge
   pointing right, and vice versa. */
.point {
  position: absolute;
  width: 0;
  height: 0;
  pointer-events: none;
  transition: opacity 0.15s;
  border-top: 6px solid transparent;
  border-bottom: 6px solid transparent;
  z-index: 1;
}
.point.left {
  transform: translate(-100%, -50%);
  border-left: 11px solid var(--strong);
}
.point.right {
  transform: translateY(-50%);
  border-right: 11px solid var(--strong);
}
.point.s1.left,
.point.s0.left {
  border-left-color: var(--weak);
}
.point.s1.right,
.point.s0.right {
  border-right-color: var(--weak);
}
.point.in.left {
  border-left-color: var(--in);
}
.point.in.right {
  border-right-color: var(--in);
}

.share {
  position: absolute;
  transform: translate(-50%, -50%);
  padding: 0 5px;
  border-radius: 4px;
  background: var(--guide-panel-bg);
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  line-height: 18px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  pointer-events: none;
  z-index: 1;
  transition: opacity 0.15s;
}
.share.few {
  color: rgba(255, 255, 255, 0.45);
  font-weight: 500;
}
.share.in {
  color: var(--in);
}

.tier {
  position: absolute;
  left: 0;
  right: 0;
  border-top: 1px dashed rgba(255, 255, 255, 0.2);
  pointer-events: none;
}
.tier span {
  position: absolute;
  left: 50%;
  transform: translate(-50%, -50%);
  padding: 0 8px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 999px;
  background: var(--guide-panel-bg);
  color: rgba(255, 255, 255, 0.55);
  font-size: 11px;
  font-weight: 700;
  line-height: 18px;
  z-index: 3;
}
.tier .t1 {
  color: #f7d87c;
  border-color: rgba(247, 216, 124, 0.5);
}
.tier .t2 {
  color: var(--color-tier-4);
  border-color: color-mix(in srgb, var(--color-tier-4) 50%, transparent);
}

.dim {
  opacity: 0.16;
}

/* Selection feedback for assistive tech only. */
.status {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

/* Compact ladder when its panel is narrow (a side column or a phone). */
@container (max-width: 700px) {
  .content {
    --row: 92px;
    --portrait: 24px;
    --portrait-gap: 3px;
  }
  .node {
    gap: 6px;
    min-height: 60px;
    padding: 6px 8px;
  }
  .name {
    font-size: 12.5px;
  }
  .name > small {
    display: none;
  }
  .share {
    font-size: 11px;
    line-height: 16px;
  }
}
</style>
