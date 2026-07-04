<script setup lang="ts">
/* The Teams page's mode row, above the display-toggle controls: the segmented
   mode picker (each mode keeps its own persisted boards, so switching is
   lossless), the active-team label (which saved team Save targets, with an
   unsaved-changes dot), and the save actions. Save updates the source team;
   with no source it degrades to Save as New, whose name popover creates a new
   record (Enter commits, Esc cancels). */

import { nextTick, ref } from 'vue'

import IconSave from '@/components/ui/IconSave.vue'
import {
  MAX_TEAM_NAME_LENGTH,
  TEAM_MODE_ORDER,
  TEAM_MODES,
  type TeamModeKey,
} from '@/lib/teams/modes'
import { useI18nStore } from '@/stores/i18n'

const { activeMode, sourceName, suggestedName } = defineProps<{
  activeMode: TeamModeKey
  // The resolved source team's name; null renders as "Unsaved team".
  sourceName: string | null
  // Content differs from the source team (never set while sourceName is null).
  dirty: boolean
  // Prefill for the Save-as-New popover ("Team N").
  suggestedName: string
}>()

const emit = defineEmits<{
  switchMode: [mode: TeamModeKey]
  save: []
  saveAsNew: [name: string]
}>()

const i18n = useI18nStore()

const popoverOpen = ref(false)
const popoverName = ref('')
const nameInput = ref<HTMLInputElement>()

const openPopover = async (): Promise<void> => {
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

// Save updates the source team; without one there is nothing to update, so the
// button opens the naming popover instead.
const handleSave = (): void => {
  if (sourceName !== null) emit('save')
  else void openPopover()
}
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

    <span class="active-team-label">
      <span class="team-label-name">{{ sourceName ?? i18n.t('app.unsaved-team') }}</span>
      <span v-if="dirty" class="dirty-dot" :title="i18n.t('app.unsaved-changes')" />
    </span>

    <div class="mode-actions">
      <button type="button" class="action-btn" @click="handleSave">
        <IconSave :size="14" class="btn-icon" />
        <span class="btn-text">{{ i18n.t('app.save') }}</span>
      </button>
      <span class="popover-anchor">
        <button type="button" class="action-btn secondary" @click="openPopover">
          {{ i18n.t('app.save-as-new') }}
        </button>
        <div v-if="popoverOpen" class="name-popover">
          <label class="name-popover-label" :for="`team-name-input`">
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
            <button type="button" class="action-btn popover-save" @click="commitPopover">
              {{ i18n.t('app.save') }}
            </button>
            <button type="button" class="action-btn secondary" @click="popoverOpen = false">
              {{ i18n.t('app.cancel') }}
            </button>
          </div>
        </div>
      </span>
      <slot name="transfer" />
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

.active-team-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  background: var(--color-bg-secondary);
  border: 1.5px dashed var(--color-border-primary);
  border-radius: var(--radius-medium);
  padding: 5px 12px;
  max-width: 220px;
}

.team-label-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dirty-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--color-warning);
  flex-shrink: 0;
}

.mode-actions {
  display: flex;
  gap: var(--spacing-lg);
  align-items: center;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  border: 2px solid var(--color-primary);
  background: var(--color-primary);
  color: #fff;
  border-radius: var(--radius-medium);
  padding: var(--spacing-xs) var(--spacing-md);
  min-height: 36px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.action-btn:hover {
  background: var(--color-primary-hover);
  border-color: var(--color-primary-hover);
}

.action-btn.secondary {
  background: var(--color-bg-primary);
  color: var(--color-text-secondary);
  border-color: var(--color-border-primary);
}

.action-btn.secondary:hover {
  color: var(--color-primary);
  border-color: var(--color-primary);
  background: var(--color-bg-tertiary);
}

.btn-icon {
  flex-shrink: 0;
}

.popover-anchor {
  position: relative;
  display: inline-flex;
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

.name-popover-actions .action-btn {
  flex: 1;
  justify-content: center;
  min-height: 30px;
  padding: 4px 8px;
  font-size: 0.8rem;
}

@media (max-width: 480px) {
  .mode-seg {
    padding: 4px 10px;
    font-size: 0.78rem;
  }

  .active-team-label {
    max-width: 160px;
  }
}
</style>
