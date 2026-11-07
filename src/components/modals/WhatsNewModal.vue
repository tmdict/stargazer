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

const { show } = defineProps<{ show: boolean }>()
const emit = defineEmits<{
  close: []
}>()

const CONTENT: Record<AppLocale, Component> = { en: WhatsNewEn, zh: WhatsNewZh, ko: WhatsNewKo }

const i18n = useI18nStore()
const gameData = useGameDataStore()

const content = computed(() => CONTENT[i18n.currentLocale])

// The pictures draw English, so their rune shapes come out the same in every
// site language.
provideHelpLocale(ref('en'))

// The pictures' boards and portraits need the game data, which not every page
// loads.
watch(
  () => show,
  (open) => open && gameData.initializeContentData(),
  { immediate: true },
)
</script>

<template>
  <BaseModal :show :label="i18n.t('app.whats-new')" close-on-link @close="emit('close')">
    <div class="whats-new">
      <component :is="content" />
    </div>
  </BaseModal>
</template>

<style scoped>
.whats-new {
  container: help / inline-size;
}

.whats-new :deep(.whats-new-intro) {
  margin: -8px 0 0;
  color: var(--reading-muted);
}

.whats-new :deep(.whats-new-entry) {
  margin-top: 40px;
}

.whats-new :deep(.whats-new-entry > h2) {
  margin: 0 0 16px;
}

.whats-new :deep(.whats-new-entry > p) {
  margin: 14px 0 0;
}

.whats-new :deep(.whats-new-links) {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 20px;
}

.whats-new :deep(.whats-new-also) {
  margin-top: 44px;
}
</style>
