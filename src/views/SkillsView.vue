<script setup lang="ts">
import { computed } from 'vue'
import { useHead } from '@unhead/vue'

import SkillsBrowser from '@/components/skill/SkillsBrowser.vue'
import { useI18nStore } from '@/stores/i18n'

const i18n = useI18nStore()
const lang = computed(() => i18n.currentLocale)

useHead({
  link: [{ rel: 'canonical', href: 'https://stargazer.tmdict.com/skills' }],
})
</script>

<template>
  <!-- SPA index: no hero selected; clicking a character navigates to its skill page. -->
  <SkillsBrowser :slug="null" :lang />
</template>
