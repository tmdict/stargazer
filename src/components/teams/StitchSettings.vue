<script setup lang="ts">
import type { StitchDirection, StitchFit } from '@/composables/useImageStitch'
import { useI18nStore } from '@/stores/i18n'

const i18n = useI18nStore()

const direction = defineModel<StitchDirection>('direction', { required: true })
const gap = defineModel<number>('gap', { required: true })
const background = defineModel<string>('background', { required: true })
const fit = defineModel<StitchFit>('fit', { required: true })
</script>

<template>
  <div class="settings">
    <div class="setting">
      <span class="setting-label">{{ i18n.t('app.direction') }}</span>
      <div class="segmented">
        <button
          class="seg-btn"
          :class="{ active: direction === 'horizontal' }"
          @click="direction = 'horizontal'"
        >
          {{ i18n.t('app.horizontal') }}
        </button>
        <button
          class="seg-btn"
          :class="{ active: direction === 'vertical' }"
          @click="direction = 'vertical'"
        >
          {{ i18n.t('app.vertical') }}
        </button>
      </div>
    </div>

    <div class="setting">
      <span class="setting-label">{{ i18n.t('app.fit') }}</span>
      <select v-model="fit" class="setting-input">
        <option value="original">{{ i18n.t('app.fit-original') }}</option>
        <option value="scale">{{ i18n.t('app.fit-scale') }}</option>
      </select>
    </div>

    <div class="setting">
      <span class="setting-label">{{ i18n.t('app.gap') }}</span>
      <div class="gap-input">
        <input v-model.number="gap" type="number" min="0" max="200" class="setting-input gap" />
        <span class="unit">px</span>
      </div>
    </div>

    <div class="setting">
      <span class="setting-label">{{ i18n.t('app.background') }}</span>
      <select v-model="background" class="setting-input">
        <option value="transparent">{{ i18n.t('app.transparent') }}</option>
        <option value="#ffffff">{{ i18n.t('app.white') }}</option>
        <option value="#000000">{{ i18n.t('app.black') }}</option>
      </select>
    </div>
  </div>
</template>

<style scoped>
.settings {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--spacing-lg);
}

.setting {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.setting-label {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.segmented {
  display: inline-flex;
  border: 2px solid var(--color-primary);
  border-radius: var(--radius-medium);
  overflow: hidden;
}

.seg-btn {
  border: none;
  background: var(--color-bg-white);
  color: var(--color-primary);
  font-size: 0.85rem;
  font-weight: 600;
  padding: var(--spacing-xs) var(--spacing-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.seg-btn.active {
  background: var(--color-primary);
  color: #fff;
}

.setting-input {
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-medium);
  background: var(--color-bg-white);
  color: var(--color-text-primary);
  font-size: 0.85rem;
  padding: var(--spacing-xs) var(--spacing-sm);
  min-height: 34px;
}

/* Custom chevron so the dropdown arrow keeps a consistent gap from the edge. */
select.setting-input {
  appearance: none;
  padding-right: 1.6rem;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right var(--spacing-sm) center;
  background-size: 12px;
}

.gap-input {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.setting-input.gap {
  width: 64px;
}

.unit {
  font-size: 0.82rem;
  color: var(--color-text-secondary);
}
</style>
