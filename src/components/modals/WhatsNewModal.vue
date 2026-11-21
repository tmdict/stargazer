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

.whats-new :deep(.whats-new-entry) {
  margin-top: 40px;
}

.whats-new :deep(.whats-new-entry > :is(h2, .link-heading)) {
  margin: 0 0 16px;
}

.whats-new :deep(.whats-new-entry > p) {
  margin: 14px 0 0;
}

.whats-new :deep(.whats-new-guides) {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  column-gap: 22px;
}

.whats-new :deep(.whats-new-guides > *) {
  display: grid;
  grid-row: span 3;
  grid-template-rows: subgrid;
  row-gap: 12px;
}

.whats-new :deep(.whats-new-guides .link-heading) {
  justify-content: flex-start;
  padding-bottom: 0;
  border-bottom: none;
}

.whats-new :deep(.whats-new-guides .rune-picture) {
  display: grid;
}

.whats-new :deep(.whats-new-guides p) {
  margin: 0;
}

@container help (max-width: 640px) {
  .whats-new :deep(.whats-new-guides) {
    grid-template-columns: minmax(0, 1fr);
  }

  .whats-new :deep(.whats-new-guides > * + *) {
    margin-top: 28px;
  }
}
</style>
