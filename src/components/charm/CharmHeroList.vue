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
  <ul class="charm-heroes">
    <li v-for="slug in heroes" :key="slug">
      <GuidePortrait :slug :lang="i18n.currentLocale" />
      <span class="name">{{ heroDisplayName(slug, lang) }}</span>
    </li>
  </ul>
</template>

<style scoped>
.charm-heroes {
  --size: 44px;
  --disc-ring: rgba(255, 255, 255, 0.25);
  display: flex;
  flex-wrap: wrap;
  gap: 12px 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.charm-heroes li {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 72px;
  margin: 0;
}

.name {
  overflow-wrap: anywhere;
  font-size: var(--reading-small-size);
  line-height: 1.2;
  text-align: center;
  color: var(--reading-muted);
}
</style>
