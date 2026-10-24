<script setup lang="ts">
/* The Supreme League generator's entry at the top of the guide index's PvP
   panel. */

import { RouterLink } from 'vue-router'

import IconChevronRight from '@/components/ui/IconChevronRight.vue'
import { SL_GENERATOR_PATH } from '@/lib/guide'
import type { AppLocale } from '@/lib/types/i18n'
import { appLabel } from '@/utils/skillLabels'

const { lang } = defineProps<{ lang: AppLocale }>()
</script>

<template>
  <section class="content generator guide-link">
    <RouterLink class="guide-title" :to="SL_GENERATOR_PATH">
      <h2>{{ appLabel('sl-title', lang) }}</h2>
      <IconChevronRight :size="18" />
    </RouterLink>
    <p class="guide-blurb">{{ appLabel('sl-blurb', lang) }}</p>
  </section>
</template>

<style scoped>
.generator {
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}
</style>
