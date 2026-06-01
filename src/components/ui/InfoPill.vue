<script setup lang="ts">
import { useI18nStore } from '@/stores/i18n'

// Green text pill shown under a seasonal artifact / phantimal icon; opens the
// info modal on click. `label` is the visible text (artifact name / faction).
defineProps<{ label: string }>()
const emit = defineEmits<{ click: [] }>()

const i18n = useI18nStore()
</script>

<template>
  <div class="info-pill-wrap">
    <button
      type="button"
      class="info-pill"
      :aria-label="i18n.t('app.info')"
      :title="i18n.t('app.info')"
      @click="emit('click')"
    >
      {{ label }}
    </button>
  </div>
</template>

<style scoped>
.info-pill-wrap {
  display: flex;
  justify-content: center;
  padding-top: 0.4rem;
}

.info-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 20px;
  padding: 0 10px;
  background: var(--color-primary);
  border: none;
  border-radius: 999px;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.info-pill:hover {
  transform: scale(1.05);
}
</style>
