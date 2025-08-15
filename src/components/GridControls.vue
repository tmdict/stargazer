<script setup lang="ts">
import { ref } from 'vue'

import { useI18nStore } from '../stores/i18n'

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
  const target = event.target as HTMLInputElement
  emit('update:showDebug', target.checked)
}

const handleArrowsChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('update:showArrows', target.checked)
}

const handleHexIdsChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('update:showHexIds', target.checked)
}

const handlePerspectiveChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('update:showPerspective', !target.checked) // Invert logic: checked = flat = showPerspective false
}

const handleSkillsChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('update:showSkills', target.checked)
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
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="btn-icon"
      >
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
      {{ i18n.t('app.link') }}
    </button>
    <button @click="handleCopyImage" class="action-btn">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="btn-icon"
      >
        <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
        <path d="m4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
      </svg>
      {{ i18n.t('app.copy') }}
    </button>
    <button @click="handleDownload" class="action-btn">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="btn-icon"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7,10 12,15 17,10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
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
