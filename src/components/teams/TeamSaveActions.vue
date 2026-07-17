<script setup lang="ts">
/* The team actions in the controls' action row, in File-menu order (New, Save,
   Save as New, Import, Export). New detaches from the source team; Save
   updates it, degrading to Save as New when there is none; its name popover
   creates a new record (Enter commits, Esc cancels). The root is
   display: contents, so every control sits directly in the action row's flex
   flow with its spacing. */

import { computed, nextTick, ref } from 'vue'

import IconDownload from '@/components/ui/IconDownload.vue'
import IconFilePlus from '@/components/ui/IconFilePlus.vue'
import IconSave from '@/components/ui/IconSave.vue'
import IconSavePlus from '@/components/ui/IconSavePlus.vue'
import IconUpload from '@/components/ui/IconUpload.vue'
import TooltipPopup from '@/components/ui/TooltipPopup.vue'
import { useArmedConfirm } from '@/composables/useArmedConfirm'
import { useHoverTooltip } from '@/composables/useHoverTooltip'
import { MAX_TEAM_NAME_LENGTH } from '@/lib/teams/modes'
import { useI18nStore } from '@/stores/i18n'

const { hasSource, suggestedName } = defineProps<{
  // Whether Save has a source team to update; false degrades Save to Save as New.
  hasSource: boolean
  // Prefill for the Save-as-New popover ("Team N").
  suggestedName: string
}>()

const emit = defineEmits<{
  newTeam: []
  save: []
  saveAsNew: [name: string]
  exportTeams: []
  // The chosen backup file's text; the caller parses/merges and reports.
  importFile: [raw: string]
}>()

const i18n = useI18nStore()

const fileInput = ref<HTMLInputElement>()

const handleFileChosen = async (event: Event): Promise<void> => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // allow re-importing the same file
  if (!file) return
  emit('importFile', await file.text())
}

const popoverOpen = ref(false)
const popoverName = ref('')
const nameInput = ref<HTMLInputElement>()

const openPopover = async (): Promise<void> => {
  hideTip()
  popoverName.value = suggestedName
  popoverOpen.value = true
  await nextTick()
  nameInput.value?.focus()
  nameInput.value?.select()
}

const commitPopover = (): void => {
  popoverOpen.value = false
  emit('saveAsNew', popoverName.value)
}

const handleSave = (): void => {
  if (hasSource) emit('save')
  else void openPopover()
}

// New discards the boards' current content, so it confirms like Clear does.
const { armed, confirm } = useArmedConfirm()

const handleNew = (): void => {
  if (!confirm('new')) return
  emit('newTeam')
}

// One shared popup serves all five actions; the hovered action's id is stored
// (not its text) so the text stays live: arming New flips it to Confirm while
// still hovered. Action buttons are hover-only: on touch the tap acts, so the
// composable suppresses the tooltip there.
type TipId = 'new' | 'save' | 'save-as-new' | 'import' | 'export'
const {
  anchor: tipTarget,
  payload: tip,
  onMouseEnter: showTip,
  onMouseLeave: hideTip,
  onTouchStart: tipTouchStart,
} = useHoverTooltip<TipId>()

const tipText = computed((): string => {
  switch (tip.value) {
    case 'new':
      return i18n.t(armed.value !== null ? 'app.confirm' : 'app.tooltip-new')
    case 'save':
      return i18n.t('app.tooltip-save')
    case 'save-as-new':
      return i18n.t('app.tooltip-save-as-new')
    case 'import':
      return i18n.t('app.tooltip-import')
    case 'export':
      return i18n.t('app.tooltip-export')
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
      :class="{ armed: armed !== null }"
      :aria-label="i18n.t(armed !== null ? 'app.confirm' : 'app.new')"
      @click="handleNew"
      @mouseenter="showTip($event, 'new')"
      @touchstart.passive="tipTouchStart"
      @mouseleave="hideTip"
    >
      <IconFilePlus :size="14" class="btn-icon" />
      <span class="btn-text">{{ i18n.t(armed !== null ? 'app.confirm' : 'app.new') }}</span>
    </button>
    <button
      type="button"
      class="control-btn"
      :aria-label="i18n.t('app.save')"
      @click="handleSave"
      @mouseenter="showTip($event, 'save')"
      @touchstart.passive="tipTouchStart"
      @mouseleave="hideTip"
    >
      <IconSave :size="14" class="btn-icon" />
      <span class="btn-text">{{ i18n.t('app.save') }}</span>
    </button>
    <span class="popover-anchor">
      <button
        type="button"
        class="control-btn secondary"
        :aria-label="i18n.t('app.save-as-new')"
        @click="openPopover"
        @mouseenter="showTip($event, 'save-as-new')"
        @touchstart.passive="tipTouchStart"
        @mouseleave="hideTip"
      >
        <IconSavePlus :size="14" class="btn-icon" />
        <span class="btn-text">{{ i18n.t('app.save-as-new') }}</span>
      </button>
      <div
        v-if="popoverOpen"
        class="name-popover"
        role="dialog"
        :aria-label="i18n.t('app.team-name')"
      >
        <label class="name-popover-label" for="team-name-input">
          {{ i18n.t('app.team-name') }}
        </label>
        <input
          id="team-name-input"
          ref="nameInput"
          v-model="popoverName"
          class="name-popover-input"
          type="text"
          :maxlength="MAX_TEAM_NAME_LENGTH"
          spellcheck="false"
          @keydown.enter.prevent="commitPopover"
          @keydown.esc="popoverOpen = false"
        />
        <div class="name-popover-actions">
          <button type="button" class="popover-btn" @click="commitPopover">
            {{ i18n.t('app.save') }}
          </button>
          <button type="button" class="popover-btn secondary" @click="popoverOpen = false">
            {{ i18n.t('app.cancel') }}
          </button>
        </div>
      </div>
    </span>
    <button
      type="button"
      class="control-btn secondary"
      :aria-label="i18n.t('app.import')"
      @click="fileInput?.click()"
      @mouseenter="showTip($event, 'import')"
      @touchstart.passive="tipTouchStart"
      @mouseleave="hideTip"
    >
      <IconUpload :size="14" class="btn-icon" />
      <span class="btn-text">{{ i18n.t('app.import') }}</span>
    </button>
    <button
      type="button"
      class="control-btn secondary"
      :aria-label="i18n.t('app.export')"
      @click="emit('exportTeams')"
      @mouseenter="showTip($event, 'export')"
      @touchstart.passive="tipTouchStart"
      @mouseleave="hideTip"
    >
      <IconDownload :size="14" class="btn-icon" />
      <span class="btn-text">{{ i18n.t('app.export') }}</span>
    </button>
    <input
      ref="fileInput"
      type="file"
      accept="application/json,.json"
      class="file-input"
      @change="handleFileChosen"
    />
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

.popover-anchor {
  position: relative;
  display: inline-flex;
}

.file-input {
  display: none;
}

.name-popover {
  position: absolute;
  top: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  z-index: var(--z-dropdown);
  background: var(--color-bg-primary);
  border: 1.5px solid var(--color-border-primary);
  border-radius: var(--radius-large);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
  padding: var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  width: 240px;
}

.name-popover-label {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-secondary);
}

.name-popover-input {
  font: inherit;
  font-size: 0.85rem;
  padding: 6px 8px;
  border: 1.5px solid var(--color-border-primary);
  border-radius: var(--radius-medium);
  background: var(--color-bg-white);
  color: var(--color-text-primary);
}

.name-popover-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.name-popover-actions {
  display: flex;
  gap: var(--spacing-sm);
}

/* Compact dialog buttons; deliberately not .control-btn, so the control bar's
   mobile icon-only collapse never applies inside the popover. */
.popover-btn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--color-primary);
  background: var(--color-primary);
  color: #fff;
  border-radius: var(--radius-medium);
  min-height: 30px;
  padding: 4px 8px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.popover-btn:hover {
  background: var(--color-primary-hover);
  border-color: var(--color-primary-hover);
}

.popover-btn.secondary {
  background: var(--color-bg-primary);
  color: var(--color-text-secondary);
  border-color: var(--color-border-primary);
}

.popover-btn.secondary:hover {
  color: var(--color-primary);
  border-color: var(--color-primary);
  background: var(--color-bg-tertiary);
}
</style>
