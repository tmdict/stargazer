<script setup lang="ts">
/* A Supreme League page's heading: its title with the BETA chip, and the
   records it reads with the link to the note on the data. */

import SlBeta from './SlBeta.vue'
import { useI18nStore } from '@/stores/i18n'

// records: the data file's season and export date, once the file has loaded.
const { title, records } = defineProps<{
  title: string
  records: { season: number; date: string } | null
}>()

const emit = defineEmits<{ about: [] }>()

const i18n = useI18nStore()
</script>

<template>
  <header class="sl-head">
    <h1>{{ title }}<SlBeta /></h1>
    <p v-if="records">
      {{ i18n.t('app.sl-records', { season: records.season, date: records.date }) }}
      <span aria-hidden="true">·</span>
      <button type="button" class="sl-about-link" @click="emit('about')">
        {{ i18n.t('app.sl-about') }}
      </button>
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

.sl-about-link:hover {
  text-decoration: underline;
}
</style>
