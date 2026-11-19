<script setup lang="ts">
/* A guide index card that lists a group of pages, a row for each. */

import { RouterLink } from 'vue-router'

import SlBeta from '@/components/guide/sl/SlBeta.vue'
import type { AppLocale } from '@/lib/types/i18n'
import { appLabel } from '@/utils/skillLabels'

export interface GuideIndexRow {
  to: string
  // The text keys of the row's name and of the line beside it.
  title: string
  blurb: string
  beta?: boolean
}

const props = defineProps<{
  lang: AppLocale
  // The text keys of the card's heading and of the line under it.
  heading: string
  blurb: string
  pages: readonly GuideIndexRow[]
}>()

const label = (key: string): string => appLabel(key, props.lang)
</script>

<template>
  <article class="container page-panel guide-panel">
    <div class="content">
      <h2>{{ label(heading) }}</h2>
      <p class="guide-blurb">{{ label(blurb) }}</p>
      <div class="rows">
        <RouterLink v-for="entry in pages" :key="entry.to" :to="entry.to">
          <span>{{ label(entry.title) }}<SlBeta v-if="entry.beta" in-link /></span>
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
