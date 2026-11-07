<script setup lang="ts">
import { computed, type Component } from 'vue'

import BaseModal from './BaseModal.vue'
import AboutEn from '@/content/about/About.en.vue'
import AboutKo from '@/content/about/About.ko.vue'
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

const CONTENT: Record<AppLocale, Component> = { en: AboutEn, zh: AboutZh, ko: AboutKo }

const i18n = useI18nStore()

const content = computed(() => CONTENT[i18n.currentLocale])
</script>

<template>
  <BaseModal :show="show" :label="i18n.t('app.about')" close-on-link @close="emit('close')">
    <component :is="content" />
  </BaseModal>
</template>
