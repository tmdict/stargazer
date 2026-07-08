<script setup lang="ts">
/* The team actions in the controls' action row, in File-menu order (New, Save,
   Save as New, Import, Export). New detaches from the source team; Save
   updates it, degrading to Save as New when there is none; its name popover
   creates a new record (Enter commits, Esc cancels). The root is
   display: contents, so every control sits directly in the action row's flex
   flow with its spacing. */

import { nextTick, ref } from 'vue'

import IconDownload from '@/components/ui/IconDownload.vue'
import IconFilePlus from '@/components/ui/IconFilePlus.vue'
import IconSave from '@/components/ui/IconSave.vue'
import IconSavePlus from '@/components/ui/IconSavePlus.vue'
import IconUpload from '@/components/ui/IconUpload.vue'
import { MAX_TEAM_NAME_LENGTH } from '@/lib/teams/modes'
import { useI18nStore } from '@/stores/i18n'

const { sourceName, suggestedName } = defineProps<{
  // The resolved source team's name Save targets; null degrades Save to
  // Save as New.
  sourceName: string | null
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
  if (sourceName !== null) emit('save')
  else void openPopover()
}
</script>

<template>
  <div class="team-save-actions">
    <!-- Danger-styled like Clear: both discard the boards' current content. -->
    <button
      type="button"
      class="team-btn danger"
      :title="i18n.t('app.tooltip-new')"
      :aria-label="i18n.t('app.new')"
      @click="emit('newTeam')"
    >
      <IconFilePlus :size="14" class="btn-icon" />
      <span class="btn-text">{{ i18n.t('app.new') }}</span>
    </button>
    <button
      type="button"
      class="team-btn"
      :title="
        sourceName !== null
          ? i18n.t('app.tooltip-save', { name: sourceName })
          : i18n.t('app.tooltip-save-as-new')
      "
      :aria-label="i18n.t('app.save')"
      @click="handleSave"
    >
      <IconSave :size="14" class="btn-icon" />
      <span class="btn-text">{{ i18n.t('app.save') }}</span>
    </button>
    <span class="popover-anchor">
      <button
        type="button"
        class="team-btn secondary"
        :title="i18n.t('app.tooltip-save-as-new')"
        :aria-label="i18n.t('app.save-as-new')"
        @click="openPopover"
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
          <button type="button" class="team-btn popover-save" @click="commitPopover">
            {{ i18n.t('app.save') }}
          </button>
          <button type="button" class="team-btn secondary" @click="popoverOpen = false">
            {{ i18n.t('app.cancel') }}
          </button>
        </div>
      </div>
    </span>
    <button
      type="button"
      class="team-btn secondary"
      :title="i18n.t('app.tooltip-import')"
      :aria-label="i18n.t('app.import')"
      @click="fileInput?.click()"
    >
      <IconUpload :size="14" class="btn-icon" />
      <span class="btn-text">{{ i18n.t('app.import') }}</span>
    </button>
    <button
      type="button"
      class="team-btn secondary"
      :title="i18n.t('app.tooltip-export')"
      :aria-label="i18n.t('app.export')"
      @click="emit('exportTeams')"
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
  </div>
</template>

<style scoped>
.team-save-actions {
  display: contents;
}

.team-btn {
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

.team-btn:hover {
  background: var(--color-primary-hover);
  border-color: var(--color-primary-hover);
}

.team-btn.secondary {
  background: var(--color-bg-primary);
  color: var(--color-text-secondary);
  border-color: var(--color-border-primary);
}

.team-btn.secondary:hover {
  color: var(--color-primary);
  border-color: var(--color-primary);
  background: var(--color-bg-tertiary);
}

.team-btn.danger {
  background: var(--color-danger);
  border-color: var(--color-danger);
}

.team-btn.danger:hover {
  background: var(--color-danger-hover);
  border-color: var(--color-danger-hover);
}

.btn-icon {
  flex-shrink: 0;
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

.name-popover-actions .team-btn {
  flex: 1;
  justify-content: center;
  min-height: 30px;
  padding: 4px 8px;
  font-size: 0.8rem;
}

/* Mobile matches the control bar's round icon-only actions. Direct-child
   selectors keep the popover's text buttons out of the icon-only treatment. */
@media (max-width: 768px) {
  .team-save-actions > .team-btn,
  .popover-anchor > .team-btn {
    border-radius: 999px;
    padding: 0;
    width: 34px;
    height: 34px;
    min-height: 0;
    justify-content: center;
  }
  .team-save-actions > .team-btn .btn-text,
  .popover-anchor > .team-btn .btn-text {
    display: none;
  }
  .team-btn .btn-icon {
    width: 18px;
    height: 18px;
  }
}

@media (max-width: 480px) {
  .team-save-actions > .team-btn,
  .popover-anchor > .team-btn {
    width: 30px;
    height: 30px;
  }
  .team-btn .btn-icon {
    width: 16px;
    height: 16px;
  }
}
</style>
