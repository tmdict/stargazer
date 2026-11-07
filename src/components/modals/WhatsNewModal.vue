<script setup lang="ts">
import { computed, ref, watch, type Component } from 'vue'

import BaseModal from './BaseModal.vue'
import WhatsNewEn from '@/content/whats-new/WhatsNew.en.vue'
import WhatsNewKo from '@/content/whats-new/WhatsNew.ko.vue'
import WhatsNewZh from '@/content/whats-new/WhatsNew.zh.vue'
import { provideHelpLocale } from '@/composables/useHelpLocale'
import type { AppLocale } from '@/lib/types/i18n'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'

import '@/styles/help.css'

const { show } = defineProps<{ show: boolean }>()
const emit = defineEmits<{
  close: []
  shown: []
}>()

const CONTENT: Record<AppLocale, Component> = { en: WhatsNewEn, zh: WhatsNewZh, ko: WhatsNewKo }

const i18n = useI18nStore()
const gameData = useGameDataStore()

const content = computed(() => CONTENT[i18n.currentLocale])

// Never pre-rendered (it mounts on first open), so the pointer type can be read
// during setup.
const touch = window.matchMedia('(pointer: coarse)').matches

// The pictures draw English, so their rune shapes come out the same in every
// site language.
provideHelpLocale(ref('en'))

// The pictures' boards and portraits need the game data, which not every page
// loads.
watch(
  () => show,
  (open) => {
    if (!open) return
    gameData.initializeContentData()
    emit('shown')
  },
  { immediate: true },
)
</script>

<template>
  <BaseModal :show :label="i18n.t('app.whats-new')" close-on-link @close="emit('close')">
    <div class="whats-new" :class="{ touch }">
      <component :is="content" />
    </div>
  </BaseModal>
</template>

<style scoped>
.whats-new {
  container: help / inline-size;
}

.whats-new :deep(h1) {
  margin-bottom: 4px;
}

.whats-new :deep(.whats-new-updated) {
  margin: 0;
  text-align: center;
}

.whats-new :deep(.whats-new-entry) {
  margin-top: 40px;
}

.whats-new :deep(.whats-new-entry > :is(h2, .link-heading)) {
  margin: 0 0 16px;
}

.whats-new :deep(.whats-new-entry > p) {
  margin: 14px 0 0;
}

.whats-new :deep(.whats-new-also) {
  margin-top: 44px;
}
</style>
