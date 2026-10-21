<script setup lang="ts">
/* One hero card in an import review: the card as the screenshot shows it
   beside the hero it is taken for, whose name opens the review's hero
   picker, the paragon and refinement pills, and the card's state, which for
   a doubtful reading confirms it. Every edit is emitted for the import's plan
   to apply. */

import ImportCell from '@/components/import/ImportCell.vue'
import ImportCellState from '@/components/import/ImportCellState.vue'
import UpgradePill from '@/components/ui/UpgradePill.vue'
import { useUnitLabels } from '@/composables/useUnitLabels'
import type { CellState } from '@/lib/import/review'

defineProps<{
  card: string
  characterId: number | null
  paragon: number
  refinement: number
  state: CellState
  edited: boolean
  // The review's hero picker is open on this card.
  open: boolean
}>()

const emit = defineEmits<{
  pick: [event: MouseEvent]
  hero: [characterId: number]
  paragon: [level: number]
  refinement: [level: number]
}>()

const { heroName, heroImage } = useUnitLabels()
</script>

<template>
  <ImportCell :class="state" :card :portrait="characterId === null ? null : heroImage(characterId)">
    <template #name>
      <button
        type="button"
        class="cell-name"
        :class="{ open }"
        :title="heroName(characterId)"
        @click="emit('pick', $event)"
      >
        {{ heroName(characterId) }}
      </button>
    </template>
    <template #meta>
      <UpgradePill
        :paragon
        :refinement
        editable
        @paragon="emit('paragon', $event)"
        @refinement="emit('refinement', $event)"
      />
      <ImportCellState
        v-if="state === 'review' && characterId !== null"
        state="review"
        :reading="heroName(characterId)"
        :title="heroName(characterId)"
        @confirm="emit('hero', characterId)"
      />
      <ImportCellState
        v-else-if="state === 'paragon'"
        state="review"
        :reading="`P${paragon}`"
        @confirm="emit('paragon', paragon)"
      />
      <ImportCellState
        v-else-if="state === 'refinement'"
        state="review"
        :reading="`R${refinement}`"
        @confirm="emit('refinement', refinement)"
      />
      <ImportCellState v-else-if="state !== 'sure'" :state />
      <ImportCellState v-else-if="edited" state="edited" />
    </template>
  </ImportCell>
</template>
