<script setup lang="ts">
/* Who Would Win?'s card on the guide index. */

import { RouterLink } from 'vue-router'

import SlBeta from '@/components/guide/sl/SlBeta.vue'
import IconChevronRight from '@/components/ui/IconChevronRight.vue'
import { WWW_PATH } from '@/lib/guide'
import type { AppLocale } from '@/lib/types/i18n'
import { appLabel } from '@/utils/skillLabels'

const { lang } = defineProps<{ lang: AppLocale }>()
</script>

<template>
  <article class="container page-panel guide-panel">
    <section class="content guide-link">
      <RouterLink class="guide-title" :to="WWW_PATH">
        <h2>{{ appLabel('www-title', lang) }}<SlBeta in-link /></h2>
        <IconChevronRight :size="18" />
      </RouterLink>
      <p class="guide-blurb">{{ appLabel('www-blurb', lang) }}</p>
    </section>
  </article>
</template>
