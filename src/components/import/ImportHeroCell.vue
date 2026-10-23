<script setup lang="ts">
/* One hero card in an import review: the card as the screenshot shows it
   beside the hero it is taken for, whose name opens the review's hero
   picker, the paragon and refinement pills, and the card's state. Each
   doubtful part of the reading has its own confirm button, and a card in
   doubt on several has one more that confirms them all. Every edit is emitted
   for the import's plan to apply. */

import ImportCell from '@/components/import/ImportCell.vue'
import ImportCellState from '@/components/import/ImportCellState.vue'
import UpgradePill from '@/components/ui/UpgradePill.vue'
import { useUnitLabels } from '@/composables/useUnitLabels'
import type { CellState, ReviewPart } from '@/lib/import/review'
import { useI18nStore } from '@/stores/i18n'

const props = defineProps<{
  card: string
  characterId: number | null
  paragon: number
  refinement: number
  state: CellState
  doubtful: readonly ReviewPart[]
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

const i18n = useI18nStore()
const { heroName, heroImage } = useUnitLabels()

const reading = (part: ReviewPart): string => {
  if (part === 'hero') return heroName(props.characterId)
  return part === 'paragon' ? `P${props.paragon}` : `R${props.refinement}`
}

const confirm = (part: ReviewPart): void => {
  if (part === 'paragon') emit('paragon', props.paragon)
  else if (part === 'refinement') emit('refinement', props.refinement)
  else if (props.characterId !== null) emit('hero', props.characterId)
}
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
        v-if="doubtful.length === 1"
        state="review"
        :reading="reading(doubtful[0]!)"
        :title="reading(doubtful[0]!)"
        @confirm="confirm(doubtful[0]!)"
      />
      <ImportCellState v-else-if="state === 'none' || state === 'duplicate'" :state />
      <ImportCellState v-else-if="edited && !doubtful.length" state="edited" />
      <div v-if="doubtful.length > 1" class="cell-confirm">
        <ImportCellState
          v-for="part in doubtful"
          :key="part"
          state="review"
          :reading="reading(part)"
          compact
          @confirm="confirm(part)"
        />
        <ImportCellState state="review" class="confirm-card" @confirm="doubtful.forEach(confirm)">
          <template #default>{{ i18n.t('app.import-confirm-card') }}</template>
        </ImportCellState>
      </div>
    </template>
  </ImportCell>
</template>

<style scoped>
.cell-confirm {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  flex-basis: 100%;
  min-width: 0;
}

.confirm-card {
  flex-basis: 100%;
}
</style>
