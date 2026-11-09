<script setup lang="ts">
/* One entry of the open list: a hero with its place, the line, or a list or
   an every entry with the heroes it brings in. Marked when it is new or moved
   against the site's list, and when an entry above already counts its heroes. */

import { computed, nextTick, ref, useTemplateRef } from 'vue'

import GuidePortrait from '@/components/guide/GuidePortrait.vue'
import { useGameDataStore } from '@/stores/gameData'
import { heroOf, RULE_HEROES } from '../rules/useRules'
import type { ListRow } from './listLayout'
import { useListWords } from './useListEditor'

// change: new against the site's list, or moved from the site's place `was`.
// also: the other entries of the list that hold this hero.
const {
  row,
  change,
  also = [],
} = defineProps<{
  row: ListRow
  name: string
  change: { kind: 'new' } | { kind: 'moved'; was: number } | null
  also?: string[]
  dim?: boolean
  open?: boolean
  lifted?: boolean
}>()

const emit = defineEmits<{
  remove: []
  rank: [place: number]
  toggle: []
  openList: [name: string]
}>()

const gameData = useGameDataStore()
const { lang, t, game, heroName, and } = useListWords()

const hero = computed(() => (row.kind === 'hero' ? heroOf(row.hero.id) : undefined))
const brought = computed(() =>
  row.kind === 'list' && typeof row.entry === 'object' && 'list' in row.entry
    ? row.entry.list
    : null,
)

const span = computed(() => {
  if (row.kind !== 'list' && row.kind !== 'every') return ''
  if (row.first) return row.first === row.last ? `#${row.first}` : `#${row.first}–${row.last}`
  return row.items.some((item) => !item.place && !item.counted) ? '=' : ''
})

const counts = computed(() => {
  if (row.kind !== 'list' && row.kind !== 'every') return ''
  const below = row.items.filter((item) => !item.place && !item.counted).length
  const counted = row.items.filter((item) => item.counted).length
  return and([
    t('hero-count', { n: row.items.length }),
    ...(below && row.first ? [t('lists-ref-below', { n: below })] : []),
    ...(counted ? [t('lists-ref-counted', { n: counted })] : []),
  ])
})

const holdsAll = computed(
  () => row.kind === 'list' && !row.loop && row.items.length === RULE_HEROES.length,
)
const addsNothing = computed(
  () =>
    (row.kind === 'list' || row.kind === 'every') &&
    !row.loop &&
    row.items.length > 0 &&
    row.items.every((item) => item.counted),
)

const editing = ref(false)
const input = useTemplateRef<HTMLInputElement>('input')

async function startRank(): Promise<void> {
  editing.value = true
  await nextTick()
  input.value?.select()
}

function commitRank(): void {
  if (!editing.value) return
  editing.value = false
  const place = parseInt(input.value?.value ?? '', 10)
  if (Number.isFinite(place)) emit('rank', place)
}

const place = (item: { place: number; counted?: boolean }): string =>
  item.counted ? '–' : item.place ? `#${item.place}` : '='
</script>

<template>
  <div
    v-if="row.kind === 'hero' && hero"
    class="card"
    :class="[change?.kind, { counted: row.hero.counted, below: !row.hero.place, dim, lifted }]"
    tabindex="0"
  >
    <span class="grip" data-grip aria-hidden="true">⋮⋮</span>
    <input
      v-if="editing"
      ref="input"
      class="rank-input"
      type="number"
      min="1"
      :value="row.hero.counted ? '' : row.hero.place || ''"
      :aria-label="t('lists-new-place')"
      @keydown.enter.prevent="commitRank"
      @keydown.esc.stop="editing = false"
      @blur="commitRank"
    />
    <button
      v-else
      type="button"
      class="rank"
      :class="{ eq: !row.hero.place && !row.hero.counted }"
      data-rank
      :title="t(row.hero.place ? 'lists-rank-tip' : 'lists-rank-below-tip')"
      @click="startRank"
    >
      {{ row.hero.counted ? '–' : row.hero.place || '=' }}
    </button>
    <GuidePortrait :slug="hero.name" :lang :size="34" />
    <div class="who">
      <span class="hero-name">{{ heroName(hero.name) }}</span>
      <span class="meta">
        <img :src="gameData.getIcon(`class-${hero.class}`)" alt="" />{{ game(hero.class) }} ·
        {{ t(hero.range === 1 ? 'lists-melee' : 'lists-ranged') }} ·
        <img :src="gameData.getIcon(`damage-${hero.damage}`)" alt="" />{{ game(hero.damage) }}
      </span>
    </div>
    <span v-if="change?.kind === 'new'" class="tag new">{{ t('lists-new') }}</span>
    <span v-else-if="change" class="tag moved">
      {{ change.was === row.index + 1 ? t('lists-moved-tag') : t('lists-was', { n: change.was }) }}
    </span>
    <span v-if="also.length" class="tag also">{{ t('lists-also-in', { lists: and(also) }) }}</span>
    <span v-if="row.hero.counted" class="tag">{{ t('lists-counted') }}</span>
    <button
      type="button"
      class="x"
      :aria-label="t('lists-take-off', { name })"
      @click="emit('remove')"
    >
      ×
    </button>
  </div>

  <div
    v-else-if="row.kind === 'line'"
    class="card line"
    :class="[change?.kind, { extra: row.extra, lifted }]"
    tabindex="0"
  >
    <span class="grip" data-grip aria-hidden="true">⋮⋮</span>
    <div class="line-text">
      <strong>{{ t('rules-line') }}</strong>
      <span>{{ t(row.extra ? 'lists-line-extra' : 'lists-line-text') }}</span>
    </div>
    <span v-if="change?.kind === 'new'" class="tag new">{{ t('lists-new') }}</span>
    <span v-else-if="change" class="tag moved">
      {{ change.was === row.index + 1 ? t('lists-moved-tag') : t('lists-was', { n: change.was }) }}
    </span>
    <button
      type="button"
      class="x"
      :aria-label="t('lists-take-off', { name })"
      @click="emit('remove')"
    >
      ×
    </button>
  </div>

  <div
    v-else-if="row.kind === 'list' || row.kind === 'every'"
    class="card ref"
    :class="[change?.kind, { broken: row.loop || row.above, lifted }]"
    tabindex="0"
  >
    <span class="grip" data-grip aria-hidden="true">⋮⋮</span>
    <div class="ref-main">
      <div class="ref-title">
        <span v-if="span" class="rank">{{ span }}</span>
        <strong>{{ name }}</strong>
        <span class="counts">{{ counts }}</span>
        <span v-if="holdsAll" class="tag all">{{ t('lists-holds-all') }}</span>
        <span v-if="addsNothing" class="tag none">{{ t('lists-adds-nothing') }}</span>
        <button type="button" class="lists-btn small" @click="emit('toggle')">
          {{ t(open ? 'lists-hide-heroes' : 'lists-show-heroes') }}
        </button>
        <button
          v-if="brought"
          type="button"
          class="lists-btn small"
          @click="emit('openList', brought)"
        >
          {{ t('lists-open-list') }}
        </button>
        <span v-if="change?.kind === 'new'" class="tag new">{{ t('lists-new') }}</span>
        <span v-else-if="change" class="tag moved">
          {{
            change.was === row.index + 1 ? t('lists-moved-tag') : t('lists-was', { n: change.was })
          }}
        </span>
      </div>
      <p v-if="row.loop" class="note">{{ t('lists-loop-note') }}</p>
      <p v-else-if="row.above" class="note">{{ t('lists-above-note') }}</p>
      <div v-if="open" class="ref-items" data-no-drag>
        <span
          v-for="item in row.items"
          :key="item.id"
          class="lists-mini"
          :class="{ counted: item.counted }"
        >
          <GuidePortrait v-if="heroOf(item.id)" :slug="heroOf(item.id)!.name" :lang :size="20" />
          <span class="at">{{ place(item) }}</span>
          {{ heroName(heroOf(item.id)?.name ?? String(item.id)) }}
        </span>
      </div>
    </div>
    <button
      type="button"
      class="x"
      :aria-label="t('lists-take-off', { name })"
      @click="emit('remove')"
    >
      ×
    </button>
  </div>
</template>

<style scoped>
.card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 4px 8px 4px 4px;
  border: 1px solid var(--panel-dark-edge);
  border-radius: var(--radius-large);
  background: var(--reading-picture);
  font-family: var(--font-ui);
  font-size: 15px;
  line-height: 1.45;
  color: var(--reading-text);
  user-select: none;
  -webkit-user-select: none;
  cursor: grab;
}

.card:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 1px;
}

.card.new {
  border-color: var(--color-accent);
  background: var(--chip-dark-active-background);
}

.card.moved {
  border-color: var(--color-warning);
  background: color-mix(in srgb, var(--color-warning) 14%, transparent);
}

.card.counted {
  border-style: dashed;
  opacity: 0.55;
}

.card.broken,
.card.extra {
  border-color: var(--color-danger);
  background: color-mix(in srgb, var(--color-danger) 18%, transparent);
}

.card.below {
  background: transparent;
}

.card.dim {
  opacity: 0.28;
}

.card.lifted {
  opacity: 0.3;
}

.card.flash {
  animation: flash 1.2s ease-out;
}

@keyframes flash {
  0%,
  40% {
    box-shadow: 0 0 0 3px var(--color-accent);
  }
  100% {
    box-shadow: 0 0 0 0 transparent;
  }
}

.grip {
  display: flex;
  align-items: center;
  align-self: stretch;
  padding: 0 3px;
  font-size: 14px;
  letter-spacing: -2px;
  color: var(--reading-muted);
  touch-action: none;
  cursor: grab;
}

.rank {
  flex: none;
  min-width: 30px;
  padding: 2px 0;
  border: 0;
  border-radius: 5px;
  background: none;
  font: inherit;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-align: right;
  color: var(--reading-muted);
  cursor: pointer;
}

.rank:hover {
  background: var(--field-dark-background);
  color: var(--reading-text);
}

.rank.eq {
  font-size: 18px;
  color: var(--color-accent);
}

.rank-input {
  width: 52px;
  padding: 2px 4px;
  border: 1px solid var(--color-accent);
  border-radius: 5px;
  background: var(--color-bg-reading);
  font-family: var(--font-ui);
  font-size: max(14px, var(--field-min-font-size));
  color: var(--reading-text);
}

.who {
  display: flex;
  flex: 1 1 140px;
  flex-wrap: wrap;
  align-items: center;
  gap: 0 14px;
  min-width: 0;
}

.hero-name {
  min-width: 150px;
  overflow: hidden;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.meta {
  display: flex;
  align-items: center;
  gap: 4px;
  overflow: hidden;
  font-size: 12px;
  white-space: nowrap;
  color: var(--reading-muted);
}

.meta img {
  width: 14px;
  height: 14px;
}

.tag {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  padding: 0 6px;
  border: 1px solid var(--chip-dark-border-color);
  border-radius: 8px;
  font-size: 11px;
  font-weight: 700;
  line-height: 17px;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--reading-muted);
}

.tag.new {
  border-color: var(--color-accent);
  background: var(--color-accent);
  color: #12302d;
}

.tag.moved {
  border-color: var(--color-warning);
  background: var(--color-warning);
  color: #3a2a05;
}

.tag.also {
  font-weight: 600;
}

.tag.all {
  border-color: transparent;
  background: var(--chip-dark-active-background);
  color: var(--color-accent);
}

.tag.none {
  border-color: transparent;
  background: color-mix(in srgb, var(--color-warning) 14%, transparent);
  color: var(--color-warning);
}

.x {
  flex: none;
  width: 26px;
  height: 26px;
  margin-left: auto;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: none;
  font-size: 18px;
  line-height: 1;
  color: var(--reading-muted);
  cursor: pointer;
}

.x:hover {
  background: color-mix(in srgb, var(--color-danger) 25%, transparent);
  color: var(--reading-text);
}

.card.line {
  padding: 8px 8px 8px 4px;
  border: 2px dashed var(--color-accent);
  background: var(--chip-dark-active-background);
}

.card.line.extra {
  border-color: var(--color-danger);
}

.line-text {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 12px;
}

.line-text strong {
  color: var(--color-accent);
}

.line-text span {
  font-size: 13px;
  color: var(--reading-muted);
}

.card.ref {
  flex-wrap: wrap;
  align-items: flex-start;
  padding: 8px 8px 8px 4px;
}

.card.ref .grip {
  align-self: center;
}

.ref-main {
  flex: 1;
  min-width: 0;
}

.ref-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
}

.ref-title .rank {
  min-width: 0;
  cursor: inherit;
}

.counts {
  font-size: 13px;
  color: var(--reading-muted);
}

.note {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--reading-text);
}

.ref-items {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 2px;
  margin-top: 6px;
  cursor: default;
}

.ref-items .lists-mini {
  gap: 8px;
  padding: 2px 8px 2px 2px;
  border-radius: var(--radius-medium);
  font-size: 13px;
}

.at {
  min-width: 34px;
  font-variant-numeric: tabular-nums;
  text-align: right;
  color: var(--reading-muted);
}

.lists-mini.counted {
  text-decoration: line-through;
  opacity: 0.5;
}

@media (max-width: 700px) {
  .hero-name {
    flex-basis: 100%;
    min-width: 0;
  }

  .meta {
    flex-wrap: wrap;
  }
}
</style>
