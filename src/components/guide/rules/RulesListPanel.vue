<script setup lang="ts">
/* A list the rules read: who reads it, its ranked heroes in order, the line,
   and the heroes below it, each run named by the entry that brought it in. */

import { computed, ref } from 'vue'

import RulesLinks from './RulesLinks.vue'
import GuidePortrait from '@/components/guide/GuidePortrait.vue'
import type { ListGroup } from '@/lib/placement/formationRules'
import type { ListSource } from '@/lib/placement/lists'
import { groupSize, heroOf, RULE_LISTS, useRulesNames } from './useRules'

const { name } = defineProps<{ name: string }>()

const emit = defineEmits<{ go: [unit: string]; open: [list: string] }>()

const { lang, t, heroNameById, listName, everyName, listLines } = useRulesNames()

const list = computed(() => RULE_LISTS[name]!)

// Heroes of a long run show as portraits alone until asked for their names.
const MANY = 24
const named = ref(new Set<number>())

const lines = computed(() => listLines(name))

const sourceKey = (source: ListSource): string => JSON.stringify(source)
const rankedSources = computed(
  () => new Set(list.value.ranked.map((group) => sourceKey(group.source))),
)

function groupName(group: ListGroup, below: boolean): string {
  const { source } = group
  if (source === null) return t(below ? 'rules-named-below' : 'rules-named')
  if ('every' in source) return everyName(source.every)
  const from = below && rankedSources.value.has(sourceKey(source))
  return t(from ? 'rules-rest-of' : 'rules-from', { list: listName(source.list) })
}

// A ranked run needs no name when the list names all its ranked heroes itself.
const rankedNamed = computed(
  () => list.value.ranked.length > 1 || list.value.ranked.some((group) => group.source !== null),
)
const rankStart = (index: number): number => groupSize(list.value.ranked.slice(0, index))
</script>

<template>
  <section class="rules-list">
    <h2>{{ listName(name) }}</h2>
    <RulesLinks
      v-for="(line, index) in lines"
      :key="index"
      :parts="line"
      class="read"
      @go="emit('go', $event)"
      @open="emit('open', $event)"
    />

    <template v-for="(group, index) in list.ranked" :key="`r${index}`">
      <p v-if="rankedNamed" class="rules-group">{{ groupName(group, false) }}</p>
      <ol class="ranked">
        <li v-for="(id, i) in group.heroes" :key="id">
          <span class="rank">{{ rankStart(index) + i + 1 }}</span>
          <GuidePortrait v-if="heroOf(id)" :slug="heroOf(id)!.name" :lang :size="26" />
          <span>{{ heroNameById(id) }}</span>
        </li>
      </ol>
    </template>

    <div v-if="list.ranked.length && list.equal.length" class="line">
      <b>{{ t('rules-line') }}</b>
      <span>{{ t('rules-line-note') }}</span>
    </div>

    <template v-for="(group, index) in list.equal" :key="`e${index}`">
      <p class="rules-group">{{ groupName(group, true) }} · {{ group.heroes.length }}</p>
      <div
        class="rules-heroes"
        :class="{ 'faces-only': group.heroes.length > MANY && !named.has(index) }"
      >
        <span v-for="id in group.heroes" :key="id" class="rules-hero">
          <GuidePortrait v-if="heroOf(id)" :slug="heroOf(id)!.name" :lang :size="22" />
          <span class="hero-name">{{ heroNameById(id) }}</span>
        </span>
      </div>
      <button
        v-if="group.heroes.length > MANY"
        type="button"
        class="names"
        @click="named.has(index) ? named.delete(index) : named.add(index)"
      >
        {{ t(named.has(index) ? 'rules-hide-names' : 'rules-show-names') }}
      </button>
    </template>
  </section>
</template>

<style scoped>
.rules-list h2 {
  margin: 0 0 4px;
}

.read {
  margin: 0 0 8px;
}

.ranked {
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ranked li {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 2px 6px 2px 0;
  border-radius: var(--radius-medium);
  font-family: var(--font-ui);
  font-size: 14px;
  line-height: 1.4;
}

.ranked li:hover {
  background: var(--field-dark-background);
}

.rank {
  min-width: 22px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-align: right;
  color: var(--reading-muted);
}

.line {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 8px;
  margin: 12px 0 4px;
  padding: 6px 10px;
  border: 2px dashed var(--color-accent);
  border-radius: var(--radius-large);
  background: var(--chip-dark-active-background);
  font-family: var(--font-ui);
  font-size: 12px;
  color: var(--reading-muted);
}

.line b {
  font-size: 13px;
  color: var(--color-accent);
}

.faces-only .rules-hero {
  padding: 2px;
  border-radius: 50%;
}

.faces-only .hero-name {
  display: none;
}

.names {
  padding: 0;
  border: 0;
  background: none;
  font-family: var(--font-ui);
  font-size: 13px;
  color: var(--color-accent);
  cursor: pointer;
}

.names:hover {
  text-decoration: underline;
}
</style>
