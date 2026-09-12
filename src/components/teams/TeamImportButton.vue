<script setup lang="ts">
/* The Import control in the action row: icon only and smaller than its
   neighbours, since reading match screenshots is a niche action. Opens the
   import modal (loaded on first use, so the Teams chunk stays small) and
   passes the finished plan upward. */

import { defineAsyncComponent, ref } from 'vue'

import IconImagePlus from '@/components/ui/IconImagePlus.vue'
import TooltipPopup from '@/components/ui/TooltipPopup.vue'
import { useHoverTooltip } from '@/composables/useHoverTooltip'
import type { TeamModeKey } from '@/lib/teams/modes'
import type { TeamImportPlan } from '@/lib/teams/teamImport'
import { useI18nStore } from '@/stores/i18n'

const TeamImportModal = defineAsyncComponent(
  () => import('@/components/modals/TeamImportModal.vue'),
)

defineProps<{ activeMode: TeamModeKey }>()

const emit = defineEmits<{
  importMatch: [plan: TeamImportPlan]
}>()

const i18n = useI18nStore()
const open = ref(false)
const {
  anchor: tipTarget,
  showTooltip,
  onMouseEnter: showTip,
  onMouseLeave: hideTip,
  onTouchStart: tipTouchStart,
} = useHoverTooltip()

const openModal = (): void => {
  hideTip()
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
    <IconImagePlus :size="14" class="btn-icon" />
  </button>
  <TeamImportModal
    v-if="open"
    :show="open"
    :active-mode
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
/* Deliberately quieter than the labelled controls: no text, tighter padding,
   the secondary tint. Keeps the row's height so the row does not jitter. */
.import-btn {
  padding: 0;
  width: 30px;
  min-height: 30px;
  height: 30px;
  justify-content: center;
  align-self: center;
  opacity: 0.75;
}

.import-btn:hover,
.import-btn:focus-visible {
  opacity: 1;
}

@media (max-width: 768px) {
  .import-btn {
    width: 28px;
    height: 28px;
  }
}
</style>
