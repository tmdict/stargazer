<script setup lang="ts">
/* Heroes of a charm popup, each a portrait over its name. */

import GuidePortrait from '@/components/guide/GuidePortrait.vue'
import type { SkillLocale } from '@/lib/types/i18n'
import { useI18nStore } from '@/stores/i18n'
import { heroDisplayName } from '@/utils/skillLabels'

defineProps<{
  heroes: readonly string[]
  // The language of the names, the popup's own.
  lang: SkillLocale
}>()

const i18n = useI18nStore()
</script>

<template>
  <!-- Not a ul: popup text styles dim every li, and these hold portraits. -->
  <div class="charm-heroes" role="list">
    <div v-for="slug in heroes" :key="slug" class="hero" role="listitem">
      <GuidePortrait :slug :lang="i18n.currentLocale" />
      <span class="name reading-meta">{{ heroDisplayName(slug, lang) }}</span>
    </div>
  </div>
</template>

<style scoped>
.charm-heroes {
  --size: 44px;
  --disc-ring: rgba(255, 255, 255, 0.25);
  display: flex;
  flex-wrap: wrap;
  gap: 12px 6px;
}

.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 72px;
}

.name {
  overflow-wrap: anywhere;
  line-height: 1.2;
  text-align: center;
}
</style>
