<script setup lang="ts">
/* How far an import has read its screenshots: the count, and a bar that fills
   by screenshot. One screenshot can take several seconds, so a sheen keeps
   crossing the bar to show the reading has not stalled. */

import { useI18nStore } from '@/stores/i18n'

const { read, total } = defineProps<{ read: number; total: number }>()

const i18n = useI18nStore()
</script>

<template>
  <div class="import-progress">
    <span class="text" role="status">{{ i18n.t('app.import-progress', { read, total }) }}</span>
    <span
      class="track"
      role="progressbar"
      aria-valuemin="0"
      :aria-valuemax="total"
      :aria-valuenow="read"
    >
      <i :style="{ width: `${(read / total) * 100}%` }" />
    </span>
  </div>
</template>

<style scoped>
.import-progress {
  display: grid;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--import-border-strong);
  border-radius: var(--radius-medium);
  background: var(--import-surface);
}

.text {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--import-text);
}

.track {
  position: relative;
  display: block;
  height: 6px;
  overflow: hidden;
  border-radius: 3px;
  background: var(--import-border);
}

.track > i {
  display: block;
  height: 100%;
  border-radius: 3px;
  background: var(--color-accent);
  transition: width 0.3s ease;
}

.track::after {
  content: '';
  position: absolute;
  inset: 0;
  width: 40%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.35), transparent);
  animation: import-progress-sheen 1.4s ease-in-out infinite;
}

@keyframes import-progress-sheen {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(250%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .track::after {
    animation: none;
    opacity: 0;
  }
}
</style>
