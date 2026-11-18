<script setup lang="ts">
/* Combat Basics entry on the guide index: a row per short rules page. */

import { RouterLink } from 'vue-router'

import { guidePath, type GuidePage } from '@/lib/guide'
import type { AppLocale } from '@/lib/types/i18n'
import { appLabel } from '@/utils/skillLabels'

const props = defineProps<{ lang: AppLocale }>()

const label = (key: string): string => appLabel(key, props.lang)

const PAGES: readonly { page: GuidePage; title: string; blurb: string }[] = [
  { page: 'factions', title: 'faction-bonus', blurb: 'guide-factions-blurb' },
  { page: 'damage', title: 'damage-types', blurb: 'guide-damage-blurb' },
  { page: 'glossary', title: 'glossary', blurb: 'guide-glossary-blurb' },
]
</script>

<template>
  <article class="container page-panel guide-panel">
    <div class="content">
      <h2>{{ label('combat-basics') }}</h2>
      <p class="guide-blurb">{{ label('guide-combat-blurb') }}</p>
      <div class="rows">
        <RouterLink v-for="entry in PAGES" :key="entry.page" :to="guidePath(entry.page)">
          <span>{{ label(entry.title) }}</span>
          <small>{{ label(entry.blurb) }}</small>
        </RouterLink>
      </div>
    </div>
  </article>
</template>

<style scoped>
.content h2 {
  margin: 0;
}
.rows {
  display: flex;
  flex-direction: column;
  margin-top: 8px;
}
.rows a {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.rows a:hover {
  text-decoration: none;
}
.rows a:last-child {
  border-bottom: none;
}
.rows span {
  flex: none;
}
.rows small {
  font-size: 12px;
  font-weight: 400;
  text-align: right;
  color: var(--reading-muted);
}
</style>
