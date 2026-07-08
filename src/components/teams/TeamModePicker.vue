<script setup lang="ts">
/* Segmented team-mode picker. Each mode keeps its own persisted boards, so
   switching is lossless. */

import { TEAM_MODE_ORDER, TEAM_MODES, type TeamModeKey } from '@/lib/teams/modes'
import { useI18nStore } from '@/stores/i18n'

defineProps<{
  activeMode: TeamModeKey
}>()

const emit = defineEmits<{
  switchMode: [mode: TeamModeKey]
}>()

const i18n = useI18nStore()
</script>

<template>
  <!-- Toggle-button semantics (not radiogroup): plain buttons already give the
       full keyboard interaction, where role="radio" would promise the roving
       arrow-key pattern without delivering it. -->
  <div class="mode-picker" role="group" :aria-label="i18n.t('app.teams')">
    <button
      v-for="key in TEAM_MODE_ORDER"
      :key="key"
      type="button"
      :aria-pressed="activeMode === key"
      class="mode-seg"
      :class="{ active: activeMode === key }"
      @click="emit('switchMode', key)"
    >
      {{ i18n.t(TEAM_MODES[key].labelKey) }}
    </button>
  </div>
</template>

<style scoped>
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
