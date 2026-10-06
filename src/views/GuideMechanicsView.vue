<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import { useRoute } from 'vue-router'

import CharacterFilterEnergy from '@/components/CharacterFilterEnergy.vue'
import GuideMechanicsCard from '@/components/guide/GuideMechanicsCard.vue'
import GuideMechanicsStrip from '@/components/guide/GuideMechanicsStrip.vue'
import FilterChip from '@/components/ui/FilterChip.vue'
import FilterIcons from '@/components/ui/FilterIcons.vue'
import IconClose from '@/components/ui/IconClose.vue'
import IconSearch from '@/components/ui/IconSearch.vue'
import { useCharacterFilters } from '@/composables/useCharacterFilters'
import { useMechanicPicks } from '@/composables/useMechanicPicks'
import { useRouteLocale } from '@/composables/useRouteLocale'
import { matchCharacterNames } from '@/composables/useSkillSearch'
import { ENERGY_KEY, fromMechanicQuery, pickKey } from '@/lib/mechanics'
import type { CharacterType } from '@/lib/types/character'
import { useGameDataStore } from '@/stores/gameData'
import { setupGuideContentMeta } from '@/utils/contentMeta'
import { interpolate } from '@/utils/interpolate'
import { appLabel, curatedHeroName, mechanicLabel } from '@/utils/skillLabels'
import { loadMechanicGroups, loadTagVocabulary } from '@/utils/tagData'

import '@/styles/content.css'
import '@/styles/guide.css'

const lang = useRouteLocale()
setupGuideContentMeta(lang, 'mechanics')

// SSG-safe: the hero data loads eagerly, so every card bakes into the static
// HTML with nothing picked.
useGameDataStore().initializeContentData()

const vocabulary = loadTagVocabulary()
const groups = loadMechanicGroups()
const listed = [...new Set(groups.flatMap((group) => group.characters))]

const optionsOf = (pick: (c: CharacterType) => string) => [...new Set(listed.map(pick))]
const factionOptions = optionsOf((c) => c.faction)
const classOptions = optionsOf((c) => c.class)

// Shallow: the cards look their heroes up in `pool` by identity.
const {
  factionFilter,
  classFilter,
  filteredCharacters: pool,
} = useCharacterFilters(shallowRef(listed))
const inPool = computed(() => new Set(pool.value))

const { picks, energyValue, toggle, toggleModifier, setEnergy, remove, clear, open, matches } =
  useMechanicPicks(vocabulary)
const matching = computed(() => pool.value.filter(matches))

const hasFilter = computed(
  () => factionFilter.value !== '' || classFilter.value !== '' || picks.value.length > 0,
)

// As in the hero pickers, a click on the toolbar's background clears every
// filter: the icons and the picked mechanics. The icon options are <button>s,
// so closest() skips a click on one.
function handleToolbarClick(e: MouseEvent) {
  if (!hasFilter.value || (e.target as HTMLElement).closest('button')) return
  factionFilter.value = ''
  classFilter.value = ''
  clear()
}

const query = ref('')
const searched = computed(() => query.value.trim())
const hits = computed(() => {
  if (!searched.value) return []
  const names = matchCharacterNames(searched.value)
  return pool.value.filter((hero) => names.has(hero.name))
})
// A search no hero answers leaves the page as it is and says so.
const found = computed(() =>
  hits.value.length > 0 ? new Set(hits.value.map((hero) => hero.name)) : null,
)
// With one hero found, the kept cards are that hero's mechanics; the search
// note offers them as chips that pick a mechanic as its card does.
const onlyHit = computed(() => (hits.value.length === 1 ? hits.value[0]! : null))

const picked = computed(() => new Set(picks.value.map(pickKey)))
const countLit = (heroes: readonly CharacterType[]): number => heroes.filter(matches).length

// A search keeps the cards its heroes are in. The icon filters drop a card
// they empty, unless it is picked; a pick never drops one.
const cards = computed(() =>
  groups
    .map((group) => ({
      key: group.key,
      heroes: group.characters.filter((hero) => inPool.value.has(hero)),
    }))
    .filter(({ key, heroes }) =>
      found.value
        ? heroes.some((hero) => found.value!.has(hero.name))
        : heroes.length > 0 || picked.value.has(key),
    ),
)

// A mechanic link (`?tag=debuff&mods=global` or `?energy=500`, e.g. a guide
// index tile) picks that mechanic. First applied after mount: the baked page
// has nothing picked, and the first client render has to match it.
const route = useRoute()
const applyLink = () => {
  const pick = fromMechanicQuery(route.query, vocabulary)
  if (pick) open(pick)
}
onMounted(applyLink)
watch([() => route.query.tag, () => route.query.mods, () => route.query.energy], applyLink)
</script>

<template>
  <main>
    <article class="container page-panel guide-panel">
      <div class="content">
        <div class="toolbar" :class="{ resettable: hasFilter }" @click="handleToolbarClick">
          <label class="search" @click.stop>
            <IconSearch :size="16" />
            <input
              v-model="query"
              type="text"
              autocomplete="off"
              :placeholder="appLabel('search-hero-names', lang)"
            />
            <button
              v-if="query"
              type="button"
              class="search-clear"
              :aria-label="appLabel('clear', lang)"
              @click="query = ''"
            >
              <IconClose :size="10" />
            </button>
          </label>
          <FilterIcons
            v-model="factionFilter"
            icon-prefix="faction"
            :options="factionOptions"
            active-border-color="var(--color-accent)"
          />
          <FilterIcons
            v-model="classFilter"
            icon-prefix="class"
            :options="classOptions"
            active-border-color="var(--color-accent)"
          />
        </div>

        <p v-if="searched && !found" class="search-note reading-meta">
          {{ interpolate(appLabel('mechanics-no-hero', lang), { query: searched }) }}
        </p>
        <p v-else-if="onlyHit" class="search-note reading-meta">
          <strong>{{ curatedHeroName(onlyHit.name, lang) }}</strong>
          <FilterChip
            v-for="card in cards"
            :key="card.key"
            dark
            :label="mechanicLabel(card.key, lang)"
            :count="countLit(card.heroes)"
            :active="picked.has(card.key)"
            @click="toggle(card.key)"
          />
        </p>

        <GuideMechanicsStrip
          v-if="picks.length > 0"
          :picks
          :heroes="matching"
          :lang
          @remove="remove"
          @clear="clear"
        />

        <div class="cards">
          <GuideMechanicsCard
            v-for="card in cards"
            :key="card.key"
            :entry="card.key"
            :heroes="card.heroes"
            :picks
            :found
            :vocabulary
            :lang
            @toggle="toggle(card.key)"
            @toggle-modifier="toggleModifier(card.key, $event)"
          >
            <template v-if="card.key === ENERGY_KEY" #controls>
              <CharacterFilterEnergy
                dark
                :model-value="energyValue"
                :active="picked.has(ENERGY_KEY)"
                :lang
                @update:model-value="setEnergy"
                @click.stop
              />
            </template>
          </GuideMechanicsCard>
        </div>
      </div>
    </article>
  </main>
</template>

<style scoped>
/* The icon filters read these two for their All label; on this dark panel
   they are relit instead of restyling the component. */
.toolbar {
  --color-text-secondary: rgba(255, 255, 255, 0.6);
  --color-primary: var(--color-accent);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-sm) var(--spacing-md);
  margin-bottom: var(--spacing-md);
}

.toolbar.resettable {
  cursor: pointer;
}

.search {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  cursor: text;
  width: 18rem;
  max-width: 100%;
  height: 2rem;
  padding: 0 var(--spacing-md);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: var(--radius-large);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.55);
}

.search:focus-within {
  border-color: var(--color-accent);
}

.search input {
  flex: 1;
  min-width: 0;
  padding: 0;
  border: none;
  outline: none;
  background: none;
  color: var(--reading-text);
  font: inherit;
  font-size: max(var(--reading-secondary-size), var(--field-min-font-size));
}

.search-clear {
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  color: inherit;
  cursor: pointer;
}

.search-note {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-sm);
  margin: 0 0 var(--spacing-md);
}

.cards {
  columns: 340px 3;
  column-gap: var(--spacing-md);
}
</style>
