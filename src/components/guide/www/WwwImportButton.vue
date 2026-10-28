<script setup lang="ts">
/* Who Would Win?'s screenshot import: opens the import modal (loaded on first
   use, so the page's chunk stays small) and hands the five games it fills to
   the page. */

import { defineAsyncComponent, ref } from 'vue'

import IconImagePlus from '@/components/ui/IconImagePlus.vue'
import type { WwwGame } from '@/lib/pvp/sl/www/match'
import { useI18nStore } from '@/stores/i18n'

const WwwImportModal = defineAsyncComponent(() => import('@/components/modals/WwwImportModal.vue'))

const emit = defineEmits<{ fill: [games: (WwwGame | null)[]] }>()

const i18n = useI18nStore()
const open = ref(false)
// Mounted on first use and kept, so the modal's leave transition plays.
const mounted = ref(false)

const openModal = (): void => {
  mounted.value = true
  open.value = true
}

const handleFill = (games: (WwwGame | null)[]): void => {
  open.value = false
  emit('fill', games)
}
</script>

<template>
  <button type="button" class="solid-btn sl-action outline" @click="openModal">
    <IconImagePlus :size="14" />
    {{ i18n.t('app.www-import-button') }}
  </button>
  <WwwImportModal v-if="mounted" :show="open" @close="open = false" @fill="handleFill" />
</template>
