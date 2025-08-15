<script setup lang="ts">
import { Team } from '../lib/types/team'
import { useI18nStore } from '../stores/i18n'

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

const setTeam = (team: Team) => {
  emit('teamChange', team)
}
</script>

<template>
  <div class="team-toggle">
    <button
      @click="setTeam(Team.ALLY)"
      :class="['team-btn', { active: selectedTeam === Team.ALLY }]"
    >
      <span v-if="showCounts">{{ i18n.t('app.ally') }} ({{ allyCount }}/{{ maxAllyCount }})</span>
      <span v-else>{{ i18n.t('app.ally') }}</span>
    </button>
    <button
      @click="setTeam(Team.ENEMY)"
      :class="['team-btn', { active: selectedTeam === Team.ENEMY }]"
    >
      <span v-if="showCounts"
        >{{ i18n.t('app.enemy') }} ({{ enemyCount }}/{{ maxEnemyCount }})</span
      >
      <span v-else>{{ i18n.t('app.enemy') }}</span>
    </button>
  </div>
</template>

<style scoped>
.team-toggle {
  display: flex;
  justify-content: center;
  gap: 0;
  background: var(--color-bg-secondary);
  border-radius: var(--radius-large);
  padding: 4px;
  border: 2px solid var(--color-border-primary);
  width: fit-content;
}

.team-btn {
  background: transparent;
  color: var(--color-text-secondary);
  border: none;
  padding: var(--spacing-sm) var(--spacing-lg);
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  transition: all var(--transition-fast);
  border-radius: var(--radius-medium);
  min-width: 120px;
}

.team-btn:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-primary);
}

.team-btn.active {
  background: var(--color-primary);
  color: white;
}

@media (max-width: 768px) {
  .team-toggle {
    width: 100%;
  }

  .team-btn {
    flex: 1;
    padding: var(--spacing-sm) var(--spacing-md);
    font-size: 0.85rem;
  }
}

@media (max-width: 480px) {
  .team-btn {
    padding: var(--spacing-xs) var(--spacing-sm);
    font-size: 0.8rem;
  }
}
</style>
