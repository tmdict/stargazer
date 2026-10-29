<script setup lang="ts">
// How far an import has read its screenshots.

import { useI18nStore } from '@/stores/i18n'

defineProps<{ read: number; total: number }>()

const i18n = useI18nStore()
</script>

<template>
  <p class="note import-progress" role="status">
    {{ i18n.t('app.import-progress', { read, total }) }}
  </p>
</template>

<style scoped>
.import-progress {
  margin: 0;
}
</style>
