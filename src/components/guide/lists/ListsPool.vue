<script setup lang="ts">
/* The Add heroes panel: heroes to add to the open list, by a press or by
   dragging them in, an every entry for a kind of hero, and a whole list. A
   card dragged onto the panel leaves the list. */

import { computed, ref } from 'vue'

import RulesSearch from '../rules/RulesSearch.vue'
import ListsChips from './ListsChips.vue'
import GuidePortrait from '@/components/guide/GuidePortrait.vue'
import DropdownSelect, { type DropdownItem } from '@/components/ui/DropdownSelect.vue'
import { matchCharacterNames } from '@/composables/useSkillSearch'
import { CLASS_ORDER } from '@/lib/filterOrder'
import { expandList } from '@/lib/placement/lists'
import type { HeroFilter } from '@/lib/placement/types'
import { useGameDataStore } from '@/stores/gameData'
import { heroesMatching, RULE_HEROES } from '../rules/useRules'
import { matchesChips } from './heroChips'
import { useListDragState } from './useListDrag'
import { useListEditor, useListWords } from './useListEditor'

const gameData = useGameDataStore()
const editor = useListEditor()
const drag = useListDragState()
const { lang, t, game, heroName, listName, everyName } = useListWords()

const query = ref('')
const filters = ref(new Set<string>())
const showOnList = ref(false)

const name = computed(() => editor.current.value)
const entries = computed(() => editor.lists.value[name.value] ?? [])
const named = computed(() => new Set(entries.value.filter((entry) => typeof entry === 'number')))
const places = computed(() => editor.layouts.value[name.value]!.places)

const shown = computed(() => {
  const searched = query.value.trim()
  const matching = searched ? matchCharacterNames(searched) : null
  return RULE_HEROES.filter(
    (hero) =>
      (showOnList.value || !named.value.has(hero.id)) &&
      (!matching || matching.has(hero.name)) &&
      matchesChips(hero, filters.value),
  )
})

// Where the open list places a hero: named on it, or brought in by another entry.
function placeTag(id: number): string {
  const at = places.value.get(id)
  if (at === undefined) return ''
  const place = at ? `#${at}` : '='
  return named.value.has(id) ? place : t('lists-via', { place })
}

const everyClasses = ref<string[]>([])
const everyRange = ref<'' | 'melee' | 'ranged'>('')
const everyDamage = ref<'' | 'physical' | 'magic'>('')
const everyFilter = computed<HeroFilter>(() => ({
  ...(everyClasses.value.length ? { class: everyClasses.value } : {}),
  ...(everyRange.value ? { range: everyRange.value } : {}),
  ...(everyDamage.value ? { damage: everyDamage.value } : {}),
}))
const everyCount = computed(() => heroesMatching(everyFilter.value).length)

function toggleClass(key: string): void {
  everyClasses.value = everyClasses.value.includes(key)
    ? everyClasses.value.filter((other) => other !== key)
    : CLASS_ORDER.filter((other) => other === key || everyClasses.value.includes(other))
}

// Lists not brought in yet, leaving out any that would bring the open list
// into itself.
const listItems = computed<DropdownItem[]>(() =>
  editor.names.value
    .filter(
      (other) =>
        other !== name.value &&
        !entries.value.some(
          (entry) => typeof entry === 'object' && 'list' in entry && entry.list === other,
        ) &&
        expandList(
          { ...editor.lists.value, [name.value]: [...entries.value, { list: other }] },
          name.value,
          { heroesMatching },
        ),
    )
    .map((other) => {
      const total = editor.layouts.value[other]!.total
      return {
        key: other,
        label: listName(other),
        meta: total === RULE_HEROES.length ? t('lists-every-hero') : total,
        selected: false,
      }
    }),
)
</script>

<template>
  <div class="lists-pool" :class="{ removing: drag.removing.value }">
    <p v-if="drag.removing.value" class="drop">{{ t('lists-drop-remove') }}</p>
    <h2>{{ t('lists-add-heroes') }}</h2>
    <RulesSearch v-model="query" />
    <div class="lists-bar">
      <ListsChips v-model="filters" :groups="['range', 'damage', 'class']" />
    </div>
    <div class="lists-bar"><ListsChips v-model="filters" :groups="['faction']" /></div>
    <label class="toggle">
      <input v-model="showOnList" type="checkbox" />
      {{ t('lists-show-on-list') }}
    </label>
    <p class="hint">{{ t('lists-pool-hint', { n: shown.length }) }}</p>
    <div class="heroes">
      <button
        v-for="hero in shown"
        :key="hero.id"
        type="button"
        class="hero"
        :class="{ on: named.has(hero.id) }"
        :data-hero="hero.id"
        @click="editor.addHero(hero.id)"
      >
        <GuidePortrait :slug="hero.name" :lang :size="26" />
        <span class="hero-name">{{ heroName(hero.name) }}</span>
        <span v-if="placeTag(hero.id)" class="at">{{ placeTag(hero.id) }}</span>
      </button>
    </div>

    <h2>{{ t('lists-add-every') }}</h2>
    <div class="lists-bar">
      <button
        v-for="key in CLASS_ORDER"
        :key
        type="button"
        class="lists-chip icon"
        :aria-pressed="everyClasses.includes(key)"
        :title="game(key)"
        :aria-label="game(key)"
        @click="toggleClass(key)"
      >
        <img :src="gameData.getIcon(`class-${key}`)" alt="" />
      </button>
    </div>
    <div class="lists-bar">
      <button
        v-for="range in ['', 'melee', 'ranged'] as const"
        :key="range"
        type="button"
        class="lists-chip"
        :aria-pressed="everyRange === range"
        @click="everyRange = range"
      >
        {{ t(range ? `lists-${range}` : 'lists-any-range') }}
      </button>
    </div>
    <div class="lists-bar">
      <button
        v-for="damage in ['', 'physical', 'magic'] as const"
        :key="damage"
        type="button"
        class="lists-chip"
        :aria-pressed="everyDamage === damage"
        @click="everyDamage = damage"
      >
        {{ damage ? game(damage) : t('lists-any-damage') }}
      </button>
    </div>
    <div class="add">
      <span>{{ everyName(everyFilter) }} ({{ everyCount }})</span>
      <button type="button" class="lists-btn small" @click="editor.addEvery(everyFilter)">
        {{ t('lists-add') }}
      </button>
    </div>
    <p class="hint">{{ t('lists-every-hint') }}</p>

    <h2>{{ t('lists-add-list') }}</h2>
    <DropdownSelect
      class="add-list"
      variant="dark"
      floating
      :label="t('lists-choose-list')"
      :items="listItems"
      @select="editor.addList"
    />
    <p class="hint">{{ t('lists-add-list-hint') }}</p>
  </div>
</template>

<style scoped>
.lists-pool {
  padding: 12px;
  font-family: var(--font-ui);
  color: var(--reading-text);
}

.lists-pool.removing {
  outline: 3px solid var(--color-danger);
  outline-offset: -3px;
  background: color-mix(in srgb, var(--color-danger) 18%, transparent);
}

.drop {
  margin: 0 0 8px;
  font-weight: 600;
}

h2 {
  padding: 0;
  border: 0;
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--reading-text);
}

h2:not(:first-of-type) {
  margin-top: 16px;
}

.lists-bar {
  margin: 8px 0;
}

.toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 4px 0 8px;
  font-size: 13px;
  color: var(--reading-muted);
}

.hint {
  margin: 0 0 8px;
  font-size: 12px;
  line-height: 1.45;
  color: var(--reading-muted);
}

.heroes {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
}

.hero {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 3px 6px 3px 3px;
  border: 1px solid var(--panel-dark-edge);
  border-radius: 20px;
  background: var(--reading-picture);
  font: inherit;
  font-size: 13px;
  text-align: left;
  color: var(--reading-text);
  user-select: none;
  -webkit-user-select: none;
  cursor: grab;
}

.hero:hover {
  border-color: var(--color-accent);
}

.hero.on {
  background: var(--chip-dark-active-background);
}

.hero-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.at {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-accent);
}

.add {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 4px 0 8px;
  font-size: 13px;
}

.add span {
  flex: 1;
}

.add-list {
  --dropdown-trigger-width: 100%;
  margin: 4px 0 8px;
}

@media (max-width: 1100px) {
  .heroes {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  }
}
</style>
