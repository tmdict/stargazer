<script setup lang="ts">
/* Map color-inversion toggle, shared by the Arena Map Editor and the 5 v 5 Maps
   tab: a labeled checkbox styled as a button, with a hover tooltip explaining it. */

import { ref } from 'vue'

import TooltipPopup from '@/components/ui/TooltipPopup.vue'
import { useI18nStore } from '@/stores/i18n'
import { useMapEditorStore } from '@/stores/mapEditor'

const i18n = useI18nStore()
const mapEditorStore = useMapEditorStore()

const showTooltip = ref(false)
const buttonElement = ref<HTMLElement>()
</script>

<template>
  <label
    ref="buttonElement"
    class="invert-toggle"
    @mouseenter="showTooltip = true"
    @mouseleave="showTooltip = false"
  >
    <input
      type="checkbox"
      :checked="mapEditorStore.isColorInverted"
      class="invert-checkbox"
      @change="mapEditorStore.toggleColorInvert()"
    />
    <span class="invert-text">{{ i18n.t('app.invert') }}</span>
  </label>

  <Teleport to="body">
    <TooltipPopup
      v-if="showTooltip && buttonElement"
      :target-element="buttonElement"
      variant="detailed"
      max-width="350px"
    >
      <template #content>
        {{ i18n.t('app.invert-tooltip') }}
      </template>
    </TooltipPopup>
  </Teleport>
</template>

<style scoped>
.invert-toggle {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  cursor: pointer;
  font-family: sans-serif;
  font-size: 0.85rem;
  font-weight: 600;
  user-select: none;
  border: 2px solid;
  border-radius: var(--radius-medium);
  padding: var(--spacing-xs) var(--spacing-md);
  transition: all var(--transition-fast);
  min-height: 30px;
  flex-shrink: 0;
  white-space: nowrap;
  color: var(--color-text-secondary);
  background: var(--color-bg-primary);
  border-color: var(--color-border-primary);
}

.invert-toggle:hover {
  background: var(--color-bg-tertiary);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.invert-checkbox {
  width: 0.9rem;
  height: 0.9rem;
  cursor: pointer;
  accent-color: var(--color-primary);
  margin: 0;
}

.invert-text {
  font-weight: 600;
}
</style>
