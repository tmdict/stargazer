<script setup lang="ts">
/* The Teams page's mode row, above the display-toggle controls: a segmented
   picker for the team mode (each mode keeps its own persisted boards, so
   switching is lossless and needs no confirmation). */

import { TEAM_MODE_ORDER, TEAM_MODES, type TeamModeKey } from '@/lib/teams/modes'
import { useI18nStore } from '@/stores/i18n'

defineProps<{
  activeMode: TeamModeKey
}>()

const emit = defineEmits<{ switchMode: [mode: TeamModeKey] }>()

const i18n = useI18nStore()
</script>

<template>
  <div class="team-mode-controls">
    <div class="mode-picker" role="radiogroup">
      <button
        v-for="key in TEAM_MODE_ORDER"
        :key="key"
        type="button"
        role="radio"
        :aria-checked="activeMode === key"
        class="mode-seg"
        :class="{ active: activeMode === key }"
        @click="emit('switchMode', key)"
      >
        {{ i18n.t(TEAM_MODES[key].labelKey) }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.team-mode-controls {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-md) var(--spacing-xl);
  padding-bottom: var(--spacing-md);
}

.mode-picker {
  display: inline-flex;
  background: var(--color-bg-secondary);
  border: 2px solid var(--color-border-primary);
  border-radius: 999px;
  padding: 3px;
  gap: 2px;
}

.mode-seg {
  border: none;
  background: transparent;
  border-radius: 999px;
  padding: 5px 16px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.mode-seg:hover:not(.active) {
  color: var(--color-primary);
  background: var(--color-bg-tertiary);
}

.mode-seg.active {
  background: var(--color-primary);
  color: #fff;
}

@media (max-width: 480px) {
  .mode-seg {
    padding: 4px 10px;
    font-size: 0.78rem;
  }
}
</style>
