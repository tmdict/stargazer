<script setup lang="ts">
import { computed } from 'vue'
import { useHead } from '@unhead/vue'

import SkillsBrowser from '@/components/skill/SkillsBrowser.vue'
import { SITE_ORIGIN } from '@/lib/site'
import { useI18nStore } from '@/stores/i18n'

const i18n = useI18nStore()
// Roster tiles link into skill pages: start the reader in the saved
// skill-text language (falls back to the app locale).
const lang = computed(() => i18n.effectiveSkillLocale)

useHead({
  title: 'Skills | Stargazer',
  meta: [{ property: 'og:url', content: `${SITE_ORIGIN}/skills` }],
  link: [{ rel: 'canonical', href: `${SITE_ORIGIN}/skills` }],
})
</script>

<template>
  <!-- SPA index: no hero selected; clicking a character navigates to its skill page. -->
  <SkillsBrowser :slug="null" :lang />
</template>
