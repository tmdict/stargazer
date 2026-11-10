<script setup lang="ts">
/* The notice that the site moved: a bar under the header that opens the
   popup. */

import { computed } from 'vue'

import { SITE_HOST } from '@/lib/site'
import { useI18nStore } from '@/stores/i18n'

const emit = defineEmits<{ open: [] }>()

const i18n = useI18nStore()

const line = computed(() => i18n.t('app.move-banner').split('{site}'))
</script>

<template>
  <button type="button" class="move-banner" @click="emit('open')">
    {{ line[0] }}<b>{{ SITE_HOST }}</b
    >{{ line[1] }}
  </button>
</template>

<style scoped>
.move-banner {
  display: block;
  width: 100%;
  padding: 9px var(--spacing-lg);
  border: none;
  border-bottom: 1px solid #1d2026;
  background: #343944;
  color: #e6e6e6;
  font: inherit;
  font-size: 14px;
  text-align: center;
  cursor: pointer;
}

.move-banner:hover {
  background: #3d4350;
}

.move-banner b {
  color: var(--color-header-gold);
}

@media (max-width: 480px) {
  .move-banner {
    text-align: left;
  }
}
</style>
