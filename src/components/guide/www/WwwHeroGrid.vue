<script setup lang="ts">
/* The hero grid both teams pick from, with the Arena picker's search and
   filters. A hero already on the team being filled is dimmed, and picking it
   again takes it off that team; the other team may still field it. */

import { computed } from 'vue'

import CharacterFilterStrip from '@/components/CharacterFilterStrip.vue'
import CharacterGrid from '@/components/CharacterGrid.vue'
import CharacterIcon from '@/components/CharacterIcon.vue'
import SkillSearchTrigger from '@/components/search/SkillSearchTrigger.vue'
import PickerSearchRow from '@/components/ui/PickerSearchRow.vue'
import { useCharacterFilters } from '@/composables/useCharacterFilters'
import type { CharacterType } from '@/lib/types/character'
import { useI18nStore } from '@/stores/i18n'

const { characters, taken } = defineProps<{
  characters: readonly CharacterType[]
  // The heroes on the team being filled.
  taken: readonly number[]
}>()

const emit = defineEmits<{ pick: [character: CharacterType] }>()

const i18n = useI18nStore()

const {
  factionFilter,
  classFilter,
  mechanicFilter,
  mechanicPool,
  filteredCharacters,
  energyPicked,
  inspectChips,
} = useCharacterFilters(computed(() => characters))

const pickBySlug = (slug: string): void => {
  const character = characters.find((c) => c.name === slug)
  if (character) emit('pick', character)
}
</script>

<template>
  <div v-scroll-chain class="www-grid">
    <p class="www-grid-hint">{{ i18n.t('app.www-pick-hint') }}</p>
    <PickerSearchRow>
      <template #default>
        <SkillSearchTrigger :select="pickBySlug" />
      </template>
    </PickerSearchRow>
    <CharacterFilterStrip
      v-model:faction-filter="factionFilter"
      v-model:class-filter="classFilter"
      v-model:mechanic-filter="mechanicFilter"
      :characters
      :mechanic-pool
    />
    <CharacterGrid>
      <CharacterIcon
        v-for="character in filteredCharacters"
        :key="character.id"
        :character
        :dimmed="taken.includes(character.id)"
        :show-energy="energyPicked"
        inspectable
        :inspect-chips
        show-outfit
        @character-click="(picked) => emit('pick', picked)"
      />
    </CharacterGrid>
  </div>
</template>

<style scoped>
.www-grid {
  display: flex;
  flex-direction: column;
  gap: var(--picker-row-gap);
  overscroll-behavior: contain;
}

.www-grid-hint {
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
  color: var(--color-text-secondary);
}

@media (max-width: 768px) {
  .www-grid {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 0 0 var(--spacing-lg);
    --filter-inset: var(--spacing-md);
  }
  .www-grid-hint {
    padding: 0 var(--spacing-md);
  }
}

@media (max-width: 480px) {
  .www-grid {
    padding: 0 0 var(--spacing-md);
    --filter-inset: var(--spacing-sm);
  }
  .www-grid-hint {
    padding: 0 var(--spacing-sm);
  }
}
</style>
