<template>
  <div class="picker">
    <WandWarsPickSlots
      :pick-state="pickState"
      :characters="characters"
      :current-pick-side="currentPickSide"
      @unpick-slot="(side, slot) => emit('unpickSlot', side, slot)"
    />

    <WandWarsHeroGrid
      :characters="characters"
      :available-heroes="availableHeroes"
      :character-images="characterImages"
      @pick-hero="(hero) => emit('pickHero', hero)"
    >
      <template #actions>
        <button class="action-btn" @click="emit('undo')">Undo</button>
        <button class="action-btn danger" @click="emit('reset')">Reset</button>
      </template>
    </WandWarsHeroGrid>
  </div>
</template>

<script setup lang="ts">
import WandWarsHeroGrid from './WandWarsHeroGrid.vue'
import WandWarsPickSlots from './WandWarsPickSlots.vue'
import type { CharacterType } from '@/lib/types/character'
import type { PickSide, PickState } from '@/wandwars/types'

defineProps<{
  pickState: PickState
  currentPickSide: PickSide | null
  characters: readonly CharacterType[]
  availableHeroes: string[]
  characterImages: Record<string, string>
}>()

const emit = defineEmits<{
  pickHero: [hero: string]
  unpickSlot: [side: PickSide, slot: number]
  reset: []
  undo: []
}>()
</script>

<style scoped>
.picker {
  background: var(--color-bg-white);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-large);
  padding: var(--spacing-lg);
}

.action-btn {
  padding: var(--spacing-xs) var(--spacing-md);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-small);
  background: var(--color-bg-white);
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 600;
  transition: background var(--transition-fast);
}

.action-btn:hover {
  background: var(--color-bg-secondary);
}

.action-btn.danger {
  color: var(--color-danger);
  border-color: var(--color-danger);
}

.action-btn.danger:hover {
  background: var(--color-danger);
  color: white;
}
</style>
