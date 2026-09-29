<script setup lang="ts">
import { useHelpTouch } from '@/composables/useHelpTouch'

defineProps<{ mouse: string; touch: string }>()

const isTouch = useHelpTouch()
</script>

<template>
  <div class="help-mode" role="group">
    <button
      type="button"
      :class="{ active: !isTouch }"
      :aria-pressed="!isTouch"
      @click="isTouch = false"
    >
      {{ mouse }}
    </button>
    <button
      type="button"
      :class="{ active: isTouch }"
      :aria-pressed="isTouch"
      @click="isTouch = true"
    >
      {{ touch }}
    </button>
  </div>
</template>

<style scoped>
.help-mode {
  display: inline-flex;
  flex-shrink: 0;
  gap: 2px;
  padding: 3px;
  font-family: var(--font-ui);
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
}

.help-mode button {
  border: none;
  background: transparent;
  border-radius: 999px;
  padding: 4px 14px;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--reading-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.help-mode button:hover:not(.active) {
  color: var(--color-accent);
  background: rgba(255, 255, 255, 0.06);
}

.help-mode button.active {
  background: var(--color-accent-active);
  color: #fff;
}
</style>
