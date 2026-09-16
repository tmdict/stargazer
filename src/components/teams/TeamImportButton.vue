<script setup lang="ts">
/* The Import control in the action row: icon only and smaller than its
   neighbours, since reading match screenshots is a niche action. Opens the
   import modal (loaded on first use, so the Teams chunk stays small) and
   passes the finished plan upward. */

import { defineAsyncComponent, ref } from 'vue'

import IconImagePlus from '@/components/ui/IconImagePlus.vue'
import TooltipPopup from '@/components/ui/TooltipPopup.vue'
import { useHoverTooltip } from '@/composables/useHoverTooltip'
import type { TeamModeKey, VariantMatch } from '@/lib/teams/modes'
import type { TeamImportPlan } from '@/lib/teams/teamImport'
import { useI18nStore } from '@/stores/i18n'

const TeamImportModal = defineAsyncComponent(
  () => import('@/components/modals/TeamImportModal.vue'),
)

defineProps<{ activeMode: TeamModeKey; variant: VariantMatch }>()

const emit = defineEmits<{
  importMatch: [plan: TeamImportPlan]
}>()

const i18n = useI18nStore()
const open = ref(false)
// Mounted on first use and kept, so the modal's leave transition plays and its
// selected card survives a close.
const mounted = ref(false)
const {
  anchor: tipTarget,
  showTooltip,
  onMouseEnter: showTip,
  onMouseLeave: hideTip,
  onTouchStart: tipTouchStart,
} = useHoverTooltip()

const openModal = (): void => {
  hideTip()
  mounted.value = true
  open.value = true
}

const handleImport = (plan: TeamImportPlan): void => {
  open.value = false
  emit('importMatch', plan)
}
</script>

<template>
  <button
    type="button"
    class="control-btn secondary import-btn"
    :aria-label="i18n.t('app.import-title')"
    @click="openModal"
    @mouseenter="showTip($event)"
    @touchstart.passive="tipTouchStart"
    @mouseleave="hideTip"
  >
    <IconImagePlus :size="16" class="btn-icon" />
  </button>
  <TeamImportModal
    v-if="mounted"
    :show="open"
    :active-mode
    :variant
    @close="open = false"
    @import-match="handleImport"
  />
  <Teleport to="body">
    <TooltipPopup v-if="showTooltip && tipTarget" :target-element="tipTarget" variant="detailed">
      <template #content>{{ i18n.t('app.import-title') }}</template>
    </TooltipPopup>
  </Teleport>
</template>

<style scoped>
/* Deliberately quieter than the labelled controls: no text, a square at the
   row's height, the secondary tint, dimmed until hovered. The widths below
   mirror .control-btn's sizes at each breakpoint, since this scoped rule
   outranks its collapse to a round icon button. */
.import-btn {
  padding: 0;
  width: 36px;
  justify-content: center;
  opacity: 0.75;
}

.import-btn:hover,
.import-btn:focus-visible {
  opacity: 1;
}

@media (max-width: 768px) {
  .import-btn {
    width: 34px;
  }
}

@media (max-width: 480px) {
  .import-btn {
    width: 30px;
  }
}
</style>
