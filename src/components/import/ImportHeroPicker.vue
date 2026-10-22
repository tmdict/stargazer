<script setup lang="ts">
/* The hero picker a review opens under a card's name: every real hero, the
   reader's candidates pinned first, and Remove while the card has a hero. A
   card may take any hero, since the review is board-free and page-wide
   uniqueness is settled on save. */

import { computed } from 'vue'

import CharacterSelectionPalette from '@/components/CharacterSelectionPalette.vue'
import SelectionPopup from '@/components/ui/SelectionPopup.vue'
import { isBaseHeroId } from '@/lib/characters/character'
import { compareCharacters } from '@/lib/filterOrder'
import type { HeroCandidate } from '@/lib/import/card/types'
import type { CharacterType } from '@/lib/types/character'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'

const { candidates } = defineProps<{
  position: { x: number; y: number }
  candidates: readonly HeroCandidate[]
  removable: boolean
}>()

const emit = defineEmits<{ pick: [characterId: number | null]; close: [] }>()

const gameData = useGameDataStore()
const i18n = useI18nStore()

const heroes = computed(() =>
  gameData.characters.filter((c) => isBaseHeroId(c.id) && !c.placeholder).sort(compareCharacters),
)

const pinned = computed(() =>
  candidates
    .map((c) => gameData.getCharacterById(c.characterId))
    .filter((c): c is CharacterType => c !== undefined),
)
</script>

<template>
  <!-- Outside the modal's container, so its clicks and Escape are stopped
       here rather than reaching the modal's own close listeners on document. -->
  <Teleport to="body">
    <SelectionPopup
      :position
      over-modal
      @close="emit('close')"
      @click.stop
      @keydown.esc.stop="emit('close')"
    >
      <CharacterSelectionPalette
        :characters="heroes"
        :pinned
        :enter-hint="i18n.t('app.import-pick-hero')"
        @pick="emit('pick', $event.id)"
      />
      <button v-if="removable" type="button" class="picker-remove" @click="emit('pick', null)">
        {{ i18n.t('app.remove-hero') }}
      </button>
    </SelectionPopup>
  </Teleport>
</template>
