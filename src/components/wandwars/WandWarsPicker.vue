<template>
  <div class="picker">
    <div class="picker-tabs">
      <button
        v-for="tab in pickerTabs"
        :key="tab.id"
        :class="['picker-tab', { active: activeTab === tab.id }]"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </div>

    <template v-if="activeTab === 'draft'">
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
    </template>

    <WandWarsMetaTeams
      v-else
      :category="activeTab"
      :match-data="matchData"
      :analysis-data="analysisData"
      :character-images="characterImages"
    />
  </div>
</template>

<script setup lang="ts">
import WandWarsHeroGrid from './WandWarsHeroGrid.vue'
import WandWarsMetaTeams from './WandWarsMetaTeams.vue'
import WandWarsPickSlots from './WandWarsPickSlots.vue'
import type { CharacterType } from '@/lib/types/character'
import type { AnalysisData, MatchResult, PickSide, PickState } from '@/wandwars/types'

defineProps<{
  pickState: PickState
  currentPickSide: PickSide | null
  characters: readonly CharacterType[]
  availableHeroes: string[]
  characterImages: Record<string, string>
  matchData: MatchResult[]
  analysisData: AnalysisData
}>()

const emit = defineEmits<{
  pickHero: [hero: string]
  unpickSlot: [side: PickSide, slot: number]
  reset: []
  undo: []
}>()

const pickerTabs = [
  { id: 'draft' as const, label: 'Draft' },
  { id: 'units' as const, label: 'Units' },
  { id: 'teams' as const, label: 'Teams' },
  { id: 'synergy' as const, label: 'Synergy' },
]

const activeTab = defineModel<'draft' | 'units' | 'teams' | 'synergy'>('activeTab', {
  default: 'draft',
})
</script>

<style scoped>
.picker {
  background: var(--color-bg-white);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-large);
  padding: var(--spacing-lg);
}

.picker-tabs {
  display: flex;
  gap: 2px;
  margin-bottom: var(--spacing-md);
  border-bottom: 2px solid var(--color-border-light);
}

.picker-tab {
  padding: var(--spacing-sm) var(--spacing-md);
  border: none;
  background: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 0.9rem;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  transition:
    color var(--transition-fast),
    border-color var(--transition-fast);
}

.picker-tab.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
  font-weight: 600;
}

.picker-tab:hover:not(.active) {
  color: var(--color-text-primary);
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
