<script setup lang="ts">
/* The Supreme League generator's card on the guide index. */

import { RouterLink } from 'vue-router'

import IconChevronRight from '@/components/ui/IconChevronRight.vue'
import { SL_GENERATOR_PATH } from '@/lib/guide'
import type { AppLocale } from '@/lib/types/i18n'
import { appLabel } from '@/utils/skillLabels'

const { lang } = defineProps<{ lang: AppLocale }>()
</script>

<template>
  <article class="container page-panel guide-panel">
    <section class="content guide-link">
      <RouterLink class="guide-title" :to="SL_GENERATOR_PATH">
        <h2>{{ appLabel('sl-title', lang) }}</h2>
        <IconChevronRight :size="18" />
      </RouterLink>
      <p class="guide-blurb">{{ appLabel('sl-blurb', lang) }}</p>
    </section>
  </article>
</template>
