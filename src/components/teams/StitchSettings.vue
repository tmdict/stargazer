<script setup lang="ts">
import type { StitchDirection, StitchFit } from '@/composables/useImageStitch'

const direction = defineModel<StitchDirection>('direction', { required: true })
const gap = defineModel<number>('gap', { required: true })
const background = defineModel<string>('background', { required: true })
const fit = defineModel<StitchFit>('fit', { required: true })
</script>

<template>
  <div class="settings">
    <div class="setting">
      <span class="setting-label">Direction</span>
      <div class="segmented">
        <button
          class="seg-btn"
          :class="{ active: direction === 'vertical' }"
          @click="direction = 'vertical'"
        >
          Vertical
        </button>
        <button
          class="seg-btn"
          :class="{ active: direction === 'horizontal' }"
          @click="direction = 'horizontal'"
        >
          Horizontal
        </button>
      </div>
    </div>

    <div class="setting">
      <span class="setting-label">Fit</span>
      <select v-model="fit" class="setting-input">
        <option value="scale">Scale to match</option>
        <option value="original">Keep original</option>
      </select>
    </div>

    <div class="setting">
      <span class="setting-label">Gap</span>
      <div class="gap-input">
        <input v-model.number="gap" type="number" min="0" max="200" class="setting-input gap" />
        <span class="unit">px</span>
      </div>
    </div>

    <div class="setting">
      <span class="setting-label">Background</span>
      <select v-model="background" class="setting-input">
        <option value="transparent">Transparent</option>
        <option value="#ffffff">White</option>
        <option value="#000000">Black</option>
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
