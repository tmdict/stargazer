<script setup lang="ts">
/* A round icon button in an upgrade dock, with its hover tooltip; `text`
   widens it into a pill for a word label. `danger` marks a two-step
   destructive control (useArmedConfirm), whose first click only arms it. */

import { watch } from 'vue'

import TooltipPopup from './TooltipPopup.vue'
import { useHoverTooltip } from '@/composables/useHoverTooltip'

const props = defineProps<{
  tip: string
  disabled?: boolean
  danger?: boolean
  armed?: boolean
  text?: boolean
}>()

const emit = defineEmits<{ click: [] }>()

const {
  anchor: tipEl,
  showTooltip: tipShown,
  onMouseEnter: showTip,
  onMouseLeave: hideTip,
  onTouchStart: tipTouchStart,
} = useHoverTooltip()

// A button disabled under the pointer never fires mouseleave, so its tip
// closes here. A repeatable action closes it on click too; an arming click
// keeps it, since the button stays live for the confirm.
watch(
  () => props.disabled,
  (disabled) => disabled && hideTip(),
)
const handleClick = (): void => {
  if (!props.danger) hideTip()
  emit('click')
}
</script>

<template>
  <button
    type="button"
    class="dock-chip"
    :class="{ danger, text, 'confirm-armed': armed }"
    :disabled
    :aria-label="tip"
    @click="handleClick"
    @mouseenter="showTip"
    @touchstart.passive="tipTouchStart"
    @mouseleave="hideTip"
  >
    <slot />
  </button>
  <Teleport to="body">
    <TooltipPopup v-if="tipShown && tipEl" :target-element="tipEl" variant="detailed">
      <template #content>{{ tip }}</template>
    </TooltipPopup>
  </Teleport>
</template>

<style scoped>
.dock-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.12);
  color: var(--color-text-secondary);
  font-size: 0.62rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.dock-chip:hover:not(:disabled):not(.danger) {
  background: rgba(0, 0, 0, 0.18);
  color: var(--color-text-primary);
}

.dock-chip:disabled {
  opacity: 0.35;
  cursor: default;
}

.danger {
  width: 18px;
  height: 18px;
  color: var(--color-danger);
}

.text {
  width: auto;
  height: 20px;
  padding: 0 7px;
}

.danger:hover:not(:disabled),
.danger.confirm-armed {
  background: var(--color-danger);
  color: #fff;
}
</style>
