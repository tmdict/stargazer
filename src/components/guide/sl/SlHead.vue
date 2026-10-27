<script setup lang="ts">
/* A Supreme League page's heading: its title with the BETA chip, and the
   records it reads with the link to the note on the data. */

import TooltipPopup from '@/components/ui/TooltipPopup.vue'
import { useInfoTip } from '@/composables/useInfoTip'
import { useI18nStore } from '@/stores/i18n'

// records: the data file's season and export date, once the file has loaded.
const { title, records } = defineProps<{
  title: string
  records: { season: number; date: string } | null
}>()

const emit = defineEmits<{ about: [] }>()

const i18n = useI18nStore()

const {
  anchor: betaAnchor,
  hoverOpen: betaOpen,
  hoverClose: betaClose,
  toggle: betaToggle,
  onTouchStart: betaTouchStart,
} = useInfoTip()
</script>

<template>
  <header class="sl-head">
    <h1>
      {{ title
      }}<button
        type="button"
        class="sl-beta"
        @mouseenter="betaOpen"
        @mouseleave="betaClose"
        @focus="betaOpen"
        @blur="betaClose"
        @click="betaToggle"
        @touchstart.passive="betaTouchStart"
      >
        BETA
      </button>
    </h1>
    <Teleport v-if="betaAnchor" to="body">
      <TooltipPopup :target-element="betaAnchor" variant="detailed" max-width="290px">
        <template #content>{{ i18n.t('app.sl-beta-tip') }}</template>
      </TooltipPopup>
    </Teleport>
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

.sl-beta {
  display: inline-flex;
  align-items: center;
  height: 18px;
  margin-left: 8px;
  padding: 0 6px;
  border: 1px solid color-mix(in srgb, var(--color-warning) 55%, transparent);
  border-radius: 9px;
  background: color-mix(in srgb, var(--color-warning) 12%, transparent);
  color: var(--color-warning);
  font-family: inherit;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  line-height: 1;
  vertical-align: top;
  cursor: help;
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
