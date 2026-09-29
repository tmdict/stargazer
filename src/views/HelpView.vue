<script setup lang="ts">
import { computed, onMounted, type Component } from 'vue'

import HelpEn from '@/content/help/Help.en.vue'
import HelpZh from '@/content/help/Help.zh.vue'
import { provideHelpTouch } from '@/composables/useHelpTouch'
import { useRouteLocale } from '@/composables/useRouteLocale'
import type { AppLocale } from '@/lib/types/i18n'
import { useGameDataStore } from '@/stores/gameData'
import { setupHelpContentMeta } from '@/utils/contentMeta'

import '@/styles/content.css'

const CONTENT: Record<AppLocale, Component> = { en: HelpEn, zh: HelpZh }

const lang = useRouteLocale()
setupHelpContentMeta(lang)

// Loads eagerly so the portraits are in the prerendered HTML.
useGameDataStore().initializeContentData()

const content = computed(() => CONTENT[lang.value])

// Set after mount: the prerendered HTML has the mouse wording, and hydration
// must match it.
const touch = provideHelpTouch()
onMounted(() => {
  touch.value = window.matchMedia('(pointer: coarse)').matches
})
</script>

<template>
  <main>
    <article class="container page-panel help" :class="{ touch }">
      <div class="content">
        <component :is="content" />
      </div>
    </article>
  </main>
</template>

<style scoped>
/* Layout for the locale content files. They render as child components, so
   the rules reach them through :deep. Their text styles come from .content. */
.help {
  /* Picture background, read by HelpScene and HelpBasicsPicture. */
  --help-panel: rgba(255, 255, 255, 0.06);
  container: help / inline-size;
  max-width: 1180px;
}

/* ---- Mouse / Touch wording ---- */

/* Hide-only, so each element keeps its own display when shown. */
.help:not(.touch) :deep(.help-touch),
.help.touch :deep(.help-mouse) {
  display: none;
}

/* ---- Copies of app controls ---- */

.help :deep(:is(.help-tab, .help-inline-btn, .upgrade-dock)) {
  font-family: var(--font-ui);
}

.help :deep(.disc.placed) {
  filter: var(--placed-filter);
}

.help :deep(.disc.placed::after) {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 2;
  background: var(--placed-overlay);
}

.help :deep(kbd) {
  display: inline-block;
  min-width: 1.6em;
  padding: 1px 6px;
  font: inherit;
  font-size: 0.76rem;
  font-weight: 700;
  line-height: 1.4;
  text-align: center;
  color: var(--color-text-primary);
  background: var(--color-bg-white);
  border: 1px solid var(--color-border-primary);
  border-bottom-width: 2px;
  border-radius: 5px;
}

.help :deep(.help-inline-btn) {
  display: inline-grid;
  place-items: center;
  vertical-align: middle;
  width: 24px;
  height: 22px;
  color: var(--color-text-secondary);
  background: var(--color-bg-primary);
  border: 1.5px solid var(--color-border-primary);
  border-radius: var(--radius-medium);
}

.help :deep(.help-inline-btn.round) {
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 50%;
  background: var(--color-primary);
  color: #fff;
}

/* Copy of TabList's open tab. */
.help :deep(.help-tab) {
  padding: 2px 1px 4px;
  border-bottom: 2px solid var(--color-accent);
  color: var(--color-accent);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  white-space: nowrap;
}

/* ---- Page structure ---- */

.help :deep(.help-top) {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px 24px;
}

/* base.css centers h1. */
.help :deep(.help-title) {
  margin: 0;
  text-align: left;
}

.help :deep(.help-intro) {
  margin: 4px 0 0;
  color: var(--reading-muted);
}

.help :deep(.help-sec) {
  margin-top: 48px;
  scroll-margin-top: 16px;
}

.help :deep(.help-sec > h2) {
  margin: 0 0 20px;
}

.help :deep(li) {
  margin: 0;
}

.help :deep(.help-grid) {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 28px 32px;
  align-items: start;
  margin: 0;
  padding: 0;
  list-style: none;
}

.help :deep(.help-grid > .help-scene) {
  grid-column: 1 / span 2;
  grid-row: 1;
}

.help :deep(.help-grid > .help-side) {
  grid-column: 3;
  grid-row: 1 / span 2;
}

.help :deep(.help-grid > .help-notes) {
  grid-column: 1 / span 2;
  grid-row: 2;
  margin-top: -14px;
}

.help :deep(.help-keys) {
  white-space: nowrap;
}

.help :deep(.help-foot) {
  margin: 36px 0 0;
}

/* ---- Grid basics ---- */

/* Each item holds a picture, so the body text's opacity and line height stay
   on its paragraph. */
.help :deep(.help-basics > li) {
  display: flex;
  flex-direction: column;
  gap: 8px;
  line-height: inherit;
  opacity: 1;
}

.help :deep(.help-basics h3) {
  margin: 6px 0 0;
}

.help :deep(.help-basics p) {
  margin: 0;
}

/* ---- Teams and Rosters ---- */

.help :deep(.help-lead) {
  margin: 0 0 14px;
}

.help :deep(.help-steps) {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
  counter-reset: help-step;
}

.help :deep(.help-steps li) {
  counter-increment: help-step;
  display: grid;
  grid-template-columns: 22px 1fr;
  gap: 9px;
}

.help :deep(.help-steps li::before) {
  content: counter(help-step);
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  margin-top: 2px;
  border-radius: 50%;
  background: var(--color-accent-active);
  color: #fff;
  font-size: 0.72rem;
  font-weight: 700;
}

.help :deep(.help-notes) {
  display: grid;
  gap: 5px;
  margin: 14px 0 0;
  padding: 12px 0 0 16px;
  border-top: 1px dashed rgba(255, 255, 255, 0.18);
}

.help :deep(.help-notes b) {
  font-weight: 600;
}

/* ---- Quick reference ---- */

.help :deep(.help-col-h) {
  margin: 0 0 12px;
}

.help :deep(.help-col-h + .help-rows + .help-col-h) {
  margin-top: 28px;
}

.help :deep(.help-rows) {
  display: grid;
  grid-template-columns: 7.25rem minmax(0, 1fr);
  align-items: center;
  gap: 10px 14px;
  /* For the key cells; the descriptions are paragraphs. */
  font-size: var(--reading-body-size);
}

.help :deep(.help-rows > :nth-child(odd)) {
  justify-self: start;
}

.help :deep(.help-rows > p) {
  margin: 0;
}

/* Full size, the upgrade bar is wider than the key column. */
.help :deep(.help-rows .upgrade-dock) {
  zoom: 0.8;
}

/* ---- Tips ---- */

.help :deep(.help-tips) {
  row-gap: 18px;
}

.help :deep(.help-tips li) {
  display: grid;
  grid-template-columns: 20px 1fr;
  gap: 9px;
}

.help :deep(.help-tips svg) {
  margin-top: 2px;
  color: var(--color-accent);
}

/* ---- Narrower columns ---- */

@container help (max-width: 900px) {
  .help :deep(.help-grid) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .help :deep(:is(.help-grid > .help-scene, .help-grid > .help-side, .help-grid > .help-notes)) {
    grid-column: 1 / -1;
    grid-row: auto;
  }

  .help :deep(.help-grid > .help-notes) {
    margin-top: 0;
  }
}

@container help (max-width: 560px) {
  .help :deep(.help-grid) {
    grid-template-columns: minmax(0, 1fr);
  }

  .help :deep(.help-sec) {
    margin-top: 36px;
  }
}
</style>
