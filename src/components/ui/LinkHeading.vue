<script setup lang="ts">
/* A section heading that links to a page, with an arrow; inside a `.link-area`
   the whole area opens it. */

import { RouterLink } from 'vue-router'

import IconChevronRight from './IconChevronRight.vue'

import '@/styles/link-area.css'

defineProps<{ to?: string; href?: string }>()
</script>

<template>
  <RouterLink v-if="to" class="link-heading" :to>
    <h2><slot /></h2>
    <IconChevronRight :size="18" />
  </RouterLink>
  <a v-else class="link-heading" :href>
    <h2><slot /></h2>
    <IconChevronRight :size="18" />
  </a>
</template>
