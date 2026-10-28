<script setup lang="ts">
/* Who Would Win?'s card on the guide index. */

import { RouterLink } from 'vue-router'

import GuidePortrait from '@/components/guide/GuidePortrait.vue'
import SlBeta from '@/components/guide/sl/SlBeta.vue'
import IconChevronRight from '@/components/ui/IconChevronRight.vue'
import { WWW_PATH } from '@/lib/guide'
import type { AppLocale } from '@/lib/types/i18n'
import { appLabel } from '@/utils/skillLabels'

const { lang } = defineProps<{ lang: AppLocale }>()

const TEAMS = {
  a: ['lamentis', 'kulu', 'gunnar', 'contess', 'gwyneth'],
  b: ['daimon', 'alna', 'zorya', 'taichi-agumon', 'senea'],
} as const
</script>

<template>
  <article class="container page-panel guide-panel">
    <section class="content guide-link">
      <RouterLink class="guide-title" :to="WWW_PATH">
        <h2>{{ appLabel('www-title', lang) }}<SlBeta in-link /></h2>
        <IconChevronRight :size="18" />
      </RouterLink>
      <p class="guide-blurb">{{ appLabel('www-blurb', lang) }}</p>
      <!-- In the page's team shades, which it keeps in both looks. -->
      <div class="face-off" data-theme="dark" aria-hidden="true">
        <div class="face-off-teams">
          <span class="face-off-team a">
            <GuidePortrait v-for="slug in TEAMS.a" :key="slug" :slug :lang />
          </span>
          <span class="face-off-vs">VS</span>
          <span class="face-off-team b">
            <GuidePortrait v-for="slug in TEAMS.b" :key="slug" :slug :lang />
          </span>
        </div>
        <span class="face-off-bar"><b>?</b></span>
      </div>
    </section>
  </article>
</template>

<style scoped>
.face-off {
  --size: clamp(18px, (100cqi - 68px) / 10, 32px);
  container-type: inline-size;
  display: grid;
  justify-items: center;
  gap: 12px;
  margin-top: 14px;
  padding: 16px 12px;
  border-radius: var(--radius-large);
  background: var(--reading-picture);
}

.face-off-teams {
  display: flex;
  align-items: center;
  gap: 10px;
}

.face-off-team {
  display: flex;
  gap: 3px;
}

.a {
  --disc-ring: var(--unit-frame-ally);
}

.b {
  --disc-ring: var(--unit-frame-enemy);
}

.face-off-vs {
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: var(--color-text-secondary);
}

.face-off-bar {
  position: relative;
  width: min(78%, 300px);
  height: 6px;
  border-radius: 3px;
  background: linear-gradient(to right, var(--unit-frame-ally) 50%, var(--unit-frame-enemy) 50%);
}

.face-off-bar b {
  position: absolute;
  top: 50%;
  left: 50%;
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border: 2px solid var(--guide-panel-bg);
  border-radius: 50%;
  background: var(--color-text-primary);
  color: var(--guide-panel-bg);
  font-size: 11px;
  line-height: 1;
  translate: -50% -50%;
}
</style>
