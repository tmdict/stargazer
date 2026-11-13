<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import CharacterFilterStrip from './CharacterFilterStrip.vue'
import CharacterGrid from './CharacterGrid.vue'
import CharacterIcon from './CharacterIcon.vue'
import SkillSearchTrigger from '@/components/search/SkillSearchTrigger.vue'
import PickerSearchRow from '@/components/ui/PickerSearchRow.vue'
import { useCharacterFilters } from '@/composables/useCharacterFilters'
import { fromMechanicQuery, toMechanicQuery } from '@/lib/mechanics'
import { skillPath } from '@/lib/skillPath'
import type { CharacterType } from '@/lib/types/character'
import type { SkillLocale } from '@/lib/types/i18n'
import { heroDisplayName } from '@/utils/skillLabels'
import { loadTagVocabulary } from '@/utils/tagData'

const props = defineProps<{
  characters: readonly CharacterType[]
  /** Skill-text language the tiles link into and name their heroes in: the
   * route prefix on skill pages (browsing keeps the reading language), the
   * saved pref on the /skills index. Every other display string stays in the
   * chrome locale. */
  linkLocale: SkillLocale
  currentSlug?: string | null
  /** The links alone, each as its hero's name: what a baked hero page carries
   * in the picker's place (SkillsBrowser). */
  namesOnly?: boolean
}>()

const heroName = (character: CharacterType) => heroDisplayName(character.name, props.linkLocale)

// Text search lives in the search overlay (SkillSearchOverlay); the panel keeps
// only the icon filters, so the grid is always visible.
// Placeholders have no skill pages, so the skills hero list leaves them out.
const {
  factionFilter,
  classFilter,
  mechanicFilter,
  mechanicPool,
  filteredCharacters,
  energyPicked,
} = useCharacterFilters(computed(() => props.characters.filter((c) => !c.placeholder)))

// A mechanic link (`/skills?tag=debuff&mods=global` or `/skills?energy=500`)
// seeds the mechanic filter. First applied after mount: the baked page has no
// query, and the first client render has to match it.
const route = useRoute()
const router = useRouter()
const applyLink = () => {
  mechanicFilter.value = fromMechanicQuery(route.query, loadTagVocabulary())
}
onMounted(applyLink)
watch([() => route.query.tag, () => route.query.mods, () => route.query.energy], applyLink)

// On the index the address names the filter, which makes it the link to share.
// Replaced, not pushed: a pick is not a step for Back to undo.
watch(mechanicFilter, (pick) => {
  if (route.name !== 'skills') return
  void router.replace({ query: pick ? toMechanicQuery(pick) : {} })
})
</script>

<template>
  <div v-scroll-chain class="skills-selection panel-min-height panel-fill">
    <PickerSearchRow>
      <SkillSearchTrigger />
    </PickerSearchRow>

    <CharacterFilterStrip
      v-if="!namesOnly"
      v-model:faction-filter="factionFilter"
      v-model:class-filter="classFilter"
      v-model:mechanic-filter="mechanicFilter"
      :characters
      :mechanic-pool
    />

    <CharacterGrid :class="{ 'hero-names': namesOnly }" :lang="namesOnly ? linkLocale : undefined">
      <RouterLink
        v-for="character in filteredCharacters"
        :key="character.id"
        :to="skillPath(linkLocale, character.name)"
        class="character-cell"
      >
        <template v-if="namesOnly">{{ heroName(character) }}</template>
        <CharacterIcon
          v-else
          :character
          hide-tooltip
          :is-selected="currentSlug === character.name"
          :show-energy="energyPicked"
          show-outfit
          :alt="heroName(character)"
          :alt-lang="linkLocale"
        />
      </RouterLink>
    </CharacterGrid>
  </div>
</template>

<style scoped>
.skills-selection {
  display: flex;
  flex-direction: column;
  gap: var(--picker-row-gap);
  /* Contain overscroll so collapsing the sheet doesn't pull/refresh the page. */
  overscroll-behavior: contain;
}

.character-cell {
  cursor: pointer;
  text-decoration: none;
  color: inherit;
}

.skills-selection .hero-names {
  justify-content: flex-start;
  gap: var(--spacing-xs) var(--spacing-md);
  font-size: var(--control-font-size);
}

.hero-names .character-cell {
  color: var(--color-text-secondary);
}

.hero-names .character-cell[aria-current] {
  color: var(--color-text-primary);
  font-weight: var(--control-font-weight);
}

@media (max-width: 768px) {
  .skills-selection {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 0 0 var(--spacing-lg);
    --filter-inset: var(--spacing-md);
  }
}

@media (max-width: 480px) {
  .skills-selection {
    padding: 0 0 var(--spacing-md);
    --filter-inset: var(--spacing-sm);
  }
}
</style>
