<script setup lang="ts">
import IconCopy from '@/components/ui/IconCopy.vue'
import IconDownload from '@/components/ui/IconDownload.vue'
import IconLink from '@/components/ui/IconLink.vue'
import { useI18nStore } from '@/stores/i18n'

const i18n = useI18nStore()

defineProps<{
  showDebug: boolean
  showArrows: boolean
  showHexIds: boolean
  showPerspective: boolean
  showSkills?: boolean
}>()

const emit = defineEmits<{
  'update:showDebug': [value: boolean]
  'update:showArrows': [value: boolean]
  'update:showHexIds': [value: boolean]
  'update:showPerspective': [value: boolean]
  'update:showSkills': [value: boolean]
  copyLink: []
  copyImage: []
  download: []
}>()

const handleDebugChange = (event: Event) => {
  if (!(event.target instanceof HTMLInputElement)) return
  emit('update:showDebug', event.target.checked)
}

const handleArrowsChange = (event: Event) => {
  if (!(event.target instanceof HTMLInputElement)) return
  emit('update:showArrows', event.target.checked)
}

const handleHexIdsChange = (event: Event) => {
  if (!(event.target instanceof HTMLInputElement)) return
  emit('update:showHexIds', event.target.checked)
}

const handlePerspectiveChange = (event: Event) => {
  if (!(event.target instanceof HTMLInputElement)) return
  emit('update:showPerspective', !event.target.checked) // Invert logic: checked = flat = showPerspective false
}

const handleSkillsChange = (event: Event) => {
  if (!(event.target instanceof HTMLInputElement)) return
  emit('update:showSkills', event.target.checked)
}

const handleCopyLink = () => {
  emit('copyLink')
}

const handleCopyImage = () => {
  emit('copyImage')
}

const handleDownload = () => {
  emit('download')
}
</script>

<template>
  <div class="grid-controls">
    <label class="grid-toggle-btn">
      <input
        type="checkbox"
        :checked="!showPerspective"
        @change="handlePerspectiveChange"
        class="grid-toggle-checkbox"
      />
      <span class="grid-toggle-text">{{ i18n.t('app.flat') }}</span>
    </label>
    <label class="grid-toggle-btn">
      <input
        type="checkbox"
        :checked="showHexIds"
        @change="handleHexIdsChange"
        class="grid-toggle-checkbox"
      />
      <span class="grid-toggle-text">{{ i18n.t('app.grid-info') }}</span>
    </label>
    <label class="grid-toggle-btn">
      <input
        type="checkbox"
        :checked="showSkills"
        @change="handleSkillsChange"
        class="grid-toggle-checkbox"
      />
      <span class="grid-toggle-text">{{ i18n.t('app.skills') }}</span>
    </label>
    <label class="grid-toggle-btn">
      <input
        type="checkbox"
        :checked="showArrows"
        @change="handleArrowsChange"
        class="grid-toggle-checkbox"
      />
      <span class="grid-toggle-text">{{ i18n.t('app.targeting') }}</span>
    </label>
    <label class="grid-toggle-btn">
      <input
        type="checkbox"
        :checked="showDebug"
        @change="handleDebugChange"
        class="grid-toggle-checkbox"
      />
      <span class="grid-toggle-text">{{ i18n.t('app.debug') }}</span>
    </label>

    <!-- Action Buttons -->
    <button @click="handleCopyLink" class="action-btn">
      <IconLink :size="14" class="btn-icon" />
      {{ i18n.t('app.link') }}
    </button>
    <button @click="handleCopyImage" class="action-btn">
      <IconCopy :size="14" class="btn-icon" />
      {{ i18n.t('app.copy') }}
    </button>
    <button @click="handleDownload" class="action-btn">
      <IconDownload :size="14" class="btn-icon" />
      {{ i18n.t('app.download') }}
    </button>
  </div>
</template>

<style scoped>
.grid-controls {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--spacing-lg);
  margin-top: var(--spacing-lg);
}

/* Base button styles shared by all control buttons */
.grid-toggle-btn,
.action-btn {
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
  min-height: 36px;
  flex-shrink: 0;
  white-space: nowrap;
}

/* Toggle button specific styles */
.grid-toggle-btn {
  color: var(--color-text-secondary);
  background: var(--color-bg-primary);
  border-color: var(--color-border-primary);
  padding: var(--spacing-sm) var(--spacing-md);
}

.grid-toggle-btn:hover {
  background: var(--color-bg-tertiary);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

/* Action button specific styles */
.action-btn {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.action-btn:hover {
  background: var(--color-primary-hover);
  border-color: var(--color-primary-hover);
}

.action-btn:active {
  transform: scale(0.95);
}

/* Checkbox inside toggle buttons */
.grid-toggle-checkbox {
  width: 0.9rem;
  height: 0.9rem;
  cursor: pointer;
  accent-color: var(--color-primary);
  margin: 0;
}

/* Text elements in buttons */
.grid-toggle-text {
  font-weight: 600;
}

.btn-icon {
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .grid-toggle-btn,
  .action-btn {
    padding: var(--spacing-xs) var(--spacing-sm);
    min-height: 32px;
    font-size: 0.85rem;
  }

  .grid-toggle-btn {
    padding: var(--spacing-xs) var(--spacing-sm);
  }
}

@media (max-width: 480px) {
  .grid-controls {
    gap: var(--spacing-sm);
  }

  .grid-toggle-btn,
  .action-btn {
    padding: 6px 10px;
    min-height: 28px;
    font-size: 0.8rem;
  }

  .grid-toggle-checkbox {
    width: 0.8rem;
    height: 0.8rem;
  }

  .btn-icon {
    width: 12px;
    height: 12px;
  }
}
</style>
