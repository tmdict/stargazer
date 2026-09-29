<script setup lang="ts">
import { computed, type Component } from 'vue'

import BaseModal from './BaseModal.vue'
import AboutEn from '@/content/about/About.en.vue'
import AboutZh from '@/content/about/About.zh.vue'
import type { AppLocale } from '@/lib/types/i18n'
import { useI18nStore } from '@/stores/i18n'

interface Props {
  show: boolean
}

defineProps<Props>()
const emit = defineEmits<{
  close: []
}>()

const CONTENT: Record<AppLocale, Component> = { en: AboutEn, zh: AboutZh }

const i18n = useI18nStore()

const content = computed(() => CONTENT[i18n.currentLocale])

// App closes the popup on route change, but the Help link clicked from Help
// changes no route. Modifier clicks open a new tab, so the popup stays.
const closeOnLink = (event: MouseEvent): void => {
  if (event.metaKey || event.ctrlKey || event.shiftKey) return
  if (event.target instanceof Element && event.target.closest('a')) emit('close')
}
</script>

<template>
  <BaseModal :show="show" :label="i18n.t('app.about')" max-width="1000px" @close="emit('close')">
    <component :is="content" @click="closeOnLink" />
  </BaseModal>
</template>
