<script setup lang="ts">
/* A guide tool's heading: its title with the BETA chip, and the line beside
   it, with the link to the note on its data. A Supreme League page's line
   names the records it reads; the shop calculator's holds its links alone. */

import SlBeta from './SlBeta.vue'
import { SL_RULES_PATH } from '@/lib/guide'
import { useI18nStore } from '@/stores/i18n'

// records: the data file's season and export date, once the file has loaded.
// rules: the page places heroes, so it links the rules it places them by.
// aboutLabel: the note link's label, on a page whose line names no records.
// guide: a page that explains the tool, linked after the note.
const {
  title,
  records = null,
  rules = false,
  guide,
} = defineProps<{
  title: string
  records?: { season: number; date: string } | null
  rules?: boolean
  aboutLabel?: string
  guide?: { to: string; label: string }
}>()

const emit = defineEmits<{ about: [] }>()

const i18n = useI18nStore()
</script>

<template>
  <header class="sl-head">
    <h1>{{ title }}<SlBeta /></h1>
    <p v-if="records || aboutLabel">
      <template v-if="records">
        {{ i18n.t('app.sl-records', { season: records.season, date: records.date }) }}
        <span aria-hidden="true">·</span>
      </template>
      <button type="button" class="sl-about-link" @click="emit('about')">
        {{ aboutLabel ?? i18n.t('app.sl-about') }}
      </button>
      <template v-if="rules">
        <span aria-hidden="true"> ·</span>
        <RouterLink :to="SL_RULES_PATH" class="sl-about-link">
          {{ i18n.t('app.rules-title') }}
        </RouterLink>
      </template>
      <template v-if="guide">
        <span aria-hidden="true"> ·</span>
        <RouterLink :to="guide.to" class="sl-about-link">{{ guide.label }}</RouterLink>
      </template>
    </p>
  </header>
</template>

<style scoped>
.sl-head {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px 12px;
}

.sl-head h1 {
  margin: 0;
  font-size: 26px;
  line-height: 1.15;
  font-weight: 700;
  text-align: left;
  color: var(--color-text-primary);
}

.sl-head p {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--color-text-secondary);
}

.sl-about-link {
  margin-left: 0.35em;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  color: var(--color-primary);
  cursor: pointer;
}

.sl-about-link:first-child {
  margin-left: 0;
}

.sl-about-link:hover {
  text-decoration: underline;
}
</style>
