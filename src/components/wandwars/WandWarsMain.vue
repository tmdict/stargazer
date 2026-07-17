<script setup lang="ts">
import { computed, ref } from 'vue'

import WandWarsHeroAdjustments from './WandWarsHeroAdjustments.vue'
import WandWarsHeroGrid from './WandWarsHeroGrid.vue'
import WandWarsPickSlots from './WandWarsPickSlots.vue'
import WandWarsPoolImport from './WandWarsPoolImport.vue'
import IconInfo from '@/components/ui/IconInfo.vue'
import TabView from '@/components/ui/TabView.vue'
import TooltipPopup from '@/components/ui/TooltipPopup.vue'
import { useInfoTip } from '@/composables/useInfoTip'
import type { CharacterType } from '@/lib/types/character'
import { useI18nStore } from '@/stores/i18n'
import type { PickSide, PickState } from '@/wandwars/types'

defineProps<{
  pickState: PickState
  currentPickSide: PickSide | null
  characters: readonly CharacterType[]
  allHeroes: string[]
  availableHeroes: string[]
  characterImages: Record<string, string>
}>()

const emit = defineEmits<{
  pickHero: [hero: string]
  unpickSlot: [side: PickSide, slot: number]
  reset: []
  undo: []
  setPool: [pool: string[]]
}>()

const showPoolImport = ref(false)
const {
  anchor: poolInfoAnchor,
  hoverOpen: poolInfoOpen,
  hoverClose: poolInfoClose,
  toggle: poolInfoToggle,
  onTouchStart: poolInfoTouchStart,
} = useInfoTip()

function handlePoolApply(pool: string[]) {
  emit('setPool', pool)
  showPoolImport.value = false
}

const i18n = useI18nStore()

type MainTab = 'draft' | 'hero-adjustments'

const tabs = computed(() => [
  { key: 'draft', label: i18n.t('wandwars.draft') },
  { key: 'hero-adjustments', label: i18n.t('wandwars.hero-adjustments') },
])

const activeTab = defineModel<MainTab>('activeTab', { default: 'draft' })
</script>

<template>
  <section class="section">
    <TabView v-model="activeTab" :tabs="tabs">
      <template #draft>
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
            <button class="action-btn" @click="showPoolImport = true">
              {{ i18n.t('wandwars.import-pool') }}
            </button>
            <button class="action-btn" @click="emit('undo')">{{ i18n.t('wandwars.undo') }}</button>
            <button class="action-btn danger" @click="emit('reset')">
              {{ i18n.t('wandwars.reset') }}
            </button>
          </template>
        </WandWarsHeroGrid>

        <div v-if="showPoolImport" class="pool-modal" @click.self="showPoolImport = false">
          <div class="pool-modal-panel">
            <div class="pool-modal-header">
              <span class="pool-modal-title">
                {{ i18n.t('wandwars.restrict-to-pool') }}
                <IconInfo
                  :size="16"
                  class="pool-modal-info"
                  @mouseenter="poolInfoOpen"
                  @mouseleave="poolInfoClose"
                  @click="poolInfoToggle"
                  @touchstart.passive="poolInfoTouchStart"
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
            v-if="poolInfoAnchor"
            :target-element="poolInfoAnchor"
            variant="detailed"
            max-width="420px"
          >
            <template #content>
              <div class="pool-info-tip">
                <p
                  v-for="(paragraph, idx) in i18n
                    .t('wandwars.messages/tooltip-pool-info')
                    .split('\n\n')"
                  :key="idx"
                >
                  {{ paragraph }}
                </p>
              </div>
            </template>
          </TooltipPopup>
        </Teleport>
      </template>

      <template #hero-adjustments>
        <WandWarsHeroAdjustments :character-images="characterImages" />
      </template>
    </TabView>
  </section>
</template>

<style scoped>
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
