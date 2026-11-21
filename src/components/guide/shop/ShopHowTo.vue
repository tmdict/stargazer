<script setup lang="ts">
/* The shop calculator's how-to: entering a shop, reading an answer card with
   pictures of two example answers, and which answer to follow. The text is
   written per language (content/hd). */

import { computed, type Component } from 'vue'

import BaseModal from '@/components/modals/BaseModal.vue'
import ShopHowToEn from '@/content/hd/ShopHowTo.en.vue'
import ShopHowToKo from '@/content/hd/ShopHowTo.ko.vue'
import ShopHowToZh from '@/content/hd/ShopHowTo.zh.vue'
import type { AppLocale } from '@/lib/types/i18n'
import { useI18nStore } from '@/stores/i18n'

defineProps<{ show: boolean }>()

const emit = defineEmits<{ close: [] }>()

const CONTENT: Record<AppLocale, Component> = { en: ShopHowToEn, zh: ShopHowToZh, ko: ShopHowToKo }

const i18n = useI18nStore()
const content = computed(() => CONTENT[i18n.currentLocale])
</script>

<template>
  <BaseModal :show :label="i18n.t('app.shop-how-to-title')" close-on-link @close="emit('close')">
    <component :is="content" />
  </BaseModal>
</template>
