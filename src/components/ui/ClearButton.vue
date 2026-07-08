<script setup lang="ts">
import IconTrash from './IconTrash.vue'
import { useI18nStore } from '@/stores/i18n'

const i18n = useI18nStore()

const emit = defineEmits<{
  click: []
}>()
</script>

<template>
  <button
    @click="emit('click')"
    class="control-btn danger clear-all-btn"
    :title="i18n.t('app.clear')"
  >
    <IconTrash :size="14" class="btn-icon" />
    <span class="btn-text">{{ i18n.t('app.clear') }}</span>
  </button>
</template>

<style scoped>
/* Desktop-only side margin so Clear reads as slightly apart from the share
   actions; on mobile spacing comes purely from the row's flex gap. */
.clear-all-btn {
  margin: 0 5px;
}

@media (max-width: 768px) {
  .clear-all-btn {
    margin: 0;
  }
}
</style>
