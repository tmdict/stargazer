<script setup lang="ts">
import { computed } from 'vue'

import { Team } from '@/lib/types/team'
import { useI18nStore } from '@/stores/i18n'

const i18n = useI18nStore()

const props = defineProps<{
  selectedTeam: Team
  showCounts?: boolean
  allyCount?: number
  enemyCount?: number
  maxAllyCount?: number
  maxEnemyCount?: number
}>()

const emit = defineEmits<{
  teamChange: [team: Team]
}>()

const isAlly = computed(() => props.selectedTeam === Team.ALLY)
const activeLabel = computed(() => i18n.t(isAlly.value ? 'app.ally' : 'app.enemy'))
const activeCount = computed(() => (isAlly.value ? props.allyCount : props.enemyCount))
const activeMax = computed(() => (isAlly.value ? props.maxAllyCount : props.maxEnemyCount))
const swapTitle = computed(() => i18n.t(isAlly.value ? 'app.enemy' : 'app.ally'))

const swap = () => {
  emit('teamChange', isAlly.value ? Team.ENEMY : Team.ALLY)
}
</script>

<template>
  <button
    type="button"
    class="team-toggle"
    :class="{ 'is-enemy': !isAlly }"
    :aria-label="`Switch to ${swapTitle}`"
    :title="`Switch to ${swapTitle}`"
    @click="swap"
  >
    <span class="active-pill" :class="isAlly ? 'is-ally' : 'is-enemy'">
      <span class="label">{{ activeLabel }}</span>
      <span v-if="showCounts" class="count">{{ activeCount }}/{{ activeMax }}</span>
    </span>
    <span class="swap-icon" aria-hidden="true">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.4"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M7 7h13M16 3l4 4-4 4" />
        <path d="M17 17H4M8 13l-4 4 4 4" />
      </svg>
    </span>
  </button>
</template>

<style scoped>
.team-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--color-bg-secondary);
  border: 2px solid var(--color-border-primary);
  border-radius: var(--radius-large);
  padding: 3px;
  cursor: pointer;
  font: inherit;
  transition: border-color var(--transition-fast);
}

/* Pill slides to the right when enemy is active; arrows take the left side. */
.team-toggle.is-enemy {
  flex-direction: row-reverse;
}

.team-toggle:hover {
  border-color: var(--color-primary);
}

.active-pill {
  display: inline-flex;
  align-items: baseline;
  justify-content: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: var(--radius-medium);
  font-size: 0.85rem;
  font-weight: 600;
  color: white;
  min-height: 24px;
}

/* Fixed label width so "Ally" and "Enemy" render the same pill size. */
.label {
  min-width: 45px;
  text-align: center;
}

.active-pill.is-ally {
  background: var(--color-ally);
}

.active-pill.is-enemy {
  background: var(--color-danger);
}

.count {
  font-variant-numeric: tabular-nums;
  font-size: 0.8em;
  opacity: 0.9;
}

.swap-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  color: var(--color-text-secondary);
}

.team-toggle:hover .swap-icon {
  color: var(--color-primary);
}

.team-toggle:active {
  transform: scale(0.97);
}

/* Minimal toolbar form: drop the Ally/Enemy word so the toggle stops being
   sized to fit it. The pill colour (green vs red, matching the tiles) plus the
   swap arrow carry the state; the count still shows when grid info is on. */
@media (max-width: 768px) {
  .label {
    display: none;
  }
  /* Round to match the circular Link/Copy/Download action buttons. */
  .team-toggle {
    border-radius: 999px;
  }
  .active-pill {
    align-items: center;
    padding: 0 9px;
    min-width: 30px;
    height: 30px;
    min-height: 0;
    border-radius: 999px;
  }
  .swap-icon {
    width: 26px;
    height: 26px;
  }
}

@media (max-width: 480px) {
  .active-pill {
    padding: 0 7px;
    min-width: 26px;
    height: 26px;
    font-size: 0.8rem;
  }
  .swap-icon {
    width: 22px;
    height: 22px;
  }
}
</style>
