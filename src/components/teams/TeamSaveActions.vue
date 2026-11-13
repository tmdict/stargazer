<script setup lang="ts">
/* The team actions in the controls' action row, in File-menu order (New, Save,
   Save as New). Every one acts on the boards' current team: New detaches from
   the source team; Save updates it, degrading to Save as New when there is
   none; its name popover creates a new record (Enter commits, Esc cancels).
   Library-wide backup (Import / Export) lives in the Saved Teams tab, beside
   the library it acts on. The root is display: contents, so every control sits
   directly in the action row's flex flow with its spacing. */

import { computed, ref, watch } from 'vue'

import ConfirmLabel from '@/components/ui/ConfirmLabel.vue'
import IconFilePlus from '@/components/ui/IconFilePlus.vue'
import IconSave from '@/components/ui/IconSave.vue'
import IconSavePlus from '@/components/ui/IconSavePlus.vue'
import NamePopover from '@/components/ui/NamePopover.vue'
import TooltipPopup from '@/components/ui/TooltipPopup.vue'
import { useArmedConfirm } from '@/composables/useArmedConfirm'
import { useHoverTooltip } from '@/composables/useHoverTooltip'
import { type TeamModeKey, type VariantMatch } from '@/lib/teams/modes'
import { useI18nStore } from '@/stores/i18n'

const { hasSource, suggestedName, activeMode, variant, sourceId } = defineProps<{
  // Whether Save has a source team to update; false degrades Save to Save as New.
  hasSource: boolean
  // Prefill for the Save-as-New popover ("Team N", "S7 SL").
  suggestedName: string
  // The boards' identity for the armed New: a change in any of the three
  // means the boards were replaced under an armed click.
  activeMode: TeamModeKey
  variant: VariantMatch
  sourceId: string | null
}>()

const emit = defineEmits<{
  newTeam: []
  save: []
  saveAsNew: [name: string]
}>()

const i18n = useI18nStore()

const popoverOpen = ref(false)

const openPopover = (): void => {
  hideTip()
  popoverOpen.value = true
}

const handleSave = (): void => {
  if (hasSource) emit('save')
  else openPopover()
}

// New discards the boards' current content, so it confirms like Clear does.
// An armed New must not outlive the boards it was armed for: a mode switch, a
// type switch, or a Load in the window replaces them, so the click disarms.
const { armed, confirm, disarm } = useArmedConfirm()
watch([() => activeMode, () => variant, () => sourceId], disarm)

const handleNew = (): void => {
  if (!confirm('new')) return
  emit('newTeam')
}

// One shared popup serves all three actions; the hovered action's id is stored
// (not its text) so the text stays live: arming New flips it to Confirm while
// still hovered. Action buttons are hover-only: on touch the tap acts, so the
// composable suppresses the tooltip there.
type TipId = 'new' | 'save' | 'save-as-new'
const {
  anchor: tipTarget,
  payload: tip,
  onMouseEnter: showTip,
  onMouseLeave: hideTip,
} = useHoverTooltip<TipId>()

const tipText = computed((): string => {
  switch (tip.value) {
    case 'new':
      return i18n.t(armed.value !== null ? 'app.confirm' : 'app.tooltip-new')
    case 'save':
      return i18n.t('app.tooltip-save')
    case 'save-as-new':
      return i18n.t('app.tooltip-save-as-new')
    default:
      return ''
  }
})
</script>

<template>
  <div class="team-save-actions">
    <!-- Danger-styled like Clear: both discard the boards' current content. -->
    <button
      type="button"
      class="control-btn danger"
      :class="{ 'confirm-armed': armed !== null }"
      :aria-label="i18n.t(armed !== null ? 'app.confirm' : 'app.new')"
      @click="handleNew"
      @mouseenter="showTip($event, 'new')"
      @mouseleave="hideTip"
    >
      <IconFilePlus :size="14" class="btn-icon" />
      <span class="btn-text">
        <ConfirmLabel :armed="armed !== null" :label="i18n.t('app.new')" />
      </span>
    </button>
    <button
      type="button"
      class="control-btn"
      :aria-label="i18n.t('app.save')"
      @click="handleSave"
      @mouseenter="showTip($event, 'save')"
      @mouseleave="hideTip"
    >
      <IconSave :size="14" class="btn-icon" />
      <span class="btn-text">{{ i18n.t('app.save') }}</span>
    </button>
    <NamePopover
      v-model:open="popoverOpen"
      :label="i18n.t('app.team-name')"
      :name="suggestedName"
      @commit="emit('saveAsNew', $event)"
    >
      <button
        type="button"
        class="control-btn secondary"
        :aria-label="i18n.t('app.save-as-new')"
        @click="openPopover"
        @mouseenter="showTip($event, 'save-as-new')"
        @mouseleave="hideTip"
      >
        <IconSavePlus :size="14" class="btn-icon" />
        <span class="btn-text">{{ i18n.t('app.save-as-new') }}</span>
      </button>
    </NamePopover>
    <Teleport to="body">
      <TooltipPopup v-if="tip && tipTarget" :target-element="tipTarget" variant="detailed">
        <template #content>{{ tipText }}</template>
      </TooltipPopup>
    </Teleport>
  </div>
</template>

<style scoped>
.team-save-actions {
  display: contents;
}
</style>
