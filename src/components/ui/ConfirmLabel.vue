<script setup lang="ts">
/* The label of a two-step confirm button (useArmedConfirm). Both texts stay in
   the layout, so the button keeps its width when armed and a quick second click
   lands on it rather than on the button beside it. */

import { useI18nStore } from '@/stores/i18n'

defineProps<{ label: string; armed: boolean }>()

const i18n = useI18nStore()
</script>

<template>
  <span class="confirm-label">
    <span :class="{ hidden: armed }">{{ label }}</span>
    <span :class="{ hidden: !armed }">{{ i18n.t('app.confirm') }}</span>
  </span>
</template>

<style scoped>
.confirm-label {
  display: inline-grid;
  place-items: center;
}

.confirm-label > span {
  grid-area: 1 / 1;
}

.confirm-label > .hidden {
  visibility: hidden;
}
</style>
