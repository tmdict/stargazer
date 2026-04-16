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
          <button class="action-btn" @click="showPoolImport = true">Import Pool</button>
          <button class="action-btn" @click="emit('undo')">Undo</button>
          <button class="action-btn danger" @click="emit('reset')">Reset</button>
        </template>
      </WandWarsHeroGrid>

      <div v-if="showPoolImport" class="pool-modal" @click.self="showPoolImport = false">
        <div class="pool-modal-panel">
          <div class="pool-modal-header">
            <span class="pool-modal-title">
              Restrict to Pool
              <IconInfo
                ref="poolInfoEl"
                :size="16"
                class="pool-modal-info"
                @mouseenter="showPoolInfo = true"
                @mouseleave="showPoolInfo = false"
              />
            </span>
            <span class="pool-modal-close" @click="showPoolImport = false">✕</span>
          </div>
          <WandWarsPoolImport
            :character-images="characterImages"
            :all-heroes="allHeroes"
            @apply="handlePoolApply"
            @cancel="showPoolImport = false"
          />
        </div>
      </div>

      <Teleport to="body">
        <TooltipPopup
          v-if="showPoolInfo && poolInfoEl?.$el"
          :target-element="poolInfoEl.$el"
          variant="detailed"
          max-width="420px"
        >
          <template #content>
            <div class="pool-info-tip">
              <p>
                Drop a screenshot of the game's 4×5 hero pool here and the app will recognize the 20
                heroes and limit picks + recommendations to just those.
              </p>
              <p>
                After upload, you can click any cell to fix a wrong guess. Then hit
                <strong>Apply Pool Filter</strong>.
              </p>
              <p>
                The two smaller buttons at the top are only needed if the game adds new heroes or
                updates art — can be ignored in most cases.
              </p>
            </div>
          </template>
        </TooltipPopup>
      </Teleport>
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
import { ref } from 'vue'

import WandWarsHeroGrid from './WandWarsHeroGrid.vue'
import WandWarsMetaTeams from './WandWarsMetaTeams.vue'
import WandWarsPickSlots from './WandWarsPickSlots.vue'
import WandWarsPoolImport from './WandWarsPoolImport.vue'
import IconInfo from '@/components/ui/IconInfo.vue'
import TooltipPopup from '@/components/ui/TooltipPopup.vue'
import type { CharacterType } from '@/lib/types/character'
import type { AnalysisData, MatchResult, PickSide, PickState } from '@/wandwars/types'

defineProps<{
  pickState: PickState
  currentPickSide: PickSide | null
  characters: readonly CharacterType[]
  allHeroes: string[]
  availableHeroes: string[]
  characterImages: Record<string, string>
  matchData: MatchResult[]
  analysisData: AnalysisData
  poolFilter: string[] | null
}>()

const emit = defineEmits<{
  pickHero: [hero: string]
  unpickSlot: [side: PickSide, slot: number]
  reset: []
  undo: []
  setPool: [pool: string[]]
  clearPool: []
}>()

const showPoolImport = ref(false)
const showPoolInfo = ref(false)
const poolInfoEl = ref<InstanceType<typeof IconInfo> | null>(null)

function handlePoolApply(pool: string[]) {
  emit('setPool', pool)
  showPoolImport.value = false
}

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
  gap: var(--spacing-sm);
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

.pool-modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  padding: var(--spacing-md);
}

.pool-modal-panel {
  background: var(--color-bg-white);
  border-radius: var(--radius-medium);
  padding: var(--spacing-lg);
  width: min(720px, 95vw);
  max-height: 90vh;
  overflow-y: auto;
}

.pool-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 700;
  font-size: 1.05rem;
  line-height: 1;
  margin-bottom: var(--spacing-md);
}

.pool-modal-title {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  line-height: 1;
}

.pool-modal-info {
  opacity: 0.5;
  cursor: help;
}

.pool-info-tip {
  font-size: 0.85rem;
  line-height: 1.45;
}

.pool-info-tip p {
  margin: 0 0 var(--spacing-xs);
}

.pool-info-tip ol {
  margin: 0 0 var(--spacing-xs);
  padding-left: 1.2em;
}

.pool-info-tip li {
  margin-bottom: 2px;
}

.pool-modal-close {
  cursor: pointer;
  color: var(--color-text-secondary);
  font-size: 1.05rem;
  line-height: 1;
  display: inline-flex;
  align-items: center;
}

.pool-modal-close:hover {
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
