<script setup lang="ts">
/* The Honor Duel shop's probability guide: the formulas behind the shop
   calculator, with tables worked out from the measured odds. The text is
   written per language (content/hd). */

import { computed, type Component } from 'vue'

import ShopProbabilityEn from '@/content/hd/ShopProbability.en.vue'
import ShopProbabilityKo from '@/content/hd/ShopProbability.ko.vue'
import ShopProbabilityZh from '@/content/hd/ShopProbability.zh.vue'
import type { AppLocale } from '@/lib/types/i18n'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import { setupShopProbabilityContentMeta } from '@/utils/contentMeta'

import '@/styles/content.css'
import '@/styles/guide.css'

const CONTENT: Record<AppLocale, Component> = {
  en: ShopProbabilityEn,
  zh: ShopProbabilityZh,
  ko: ShopProbabilityKo,
}

const i18n = useI18nStore()
const lang = computed(() => i18n.currentLocale)
setupShopProbabilityContentMeta(lang)

// The hero pools are counted from the hero data, in the pre-rendered page too.
useGameDataStore().initializeContentData()

const content = computed(() => CONTENT[lang.value])
</script>

<template>
  <main>
    <article class="container page-panel guide-panel">
      <div class="content shop-probability">
        <component :is="content" />
      </div>
    </article>
  </main>
</template>

<style scoped>
.shop-probability :deep(.formula) {
  margin: 12px 0;
  padding: 10px 14px;
  overflow-x: auto;
  border-left: 3px solid var(--color-accent);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
</style>
