<script setup lang="ts">
import IconLocaleEn from './IconLocaleEn.vue'
import IconLocaleZh from './IconLocaleZh.vue'
import type { AppLocale } from '@/lib/types/i18n'

// Modal header en/中 toggle, shared by the artifact/phantimal modals (the
// skill modal uses the SkillLocaleMenu globe instead).
const locale = defineModel<AppLocale>({ required: true })

const toggle = () => {
  locale.value = locale.value === 'en' ? 'zh' : 'en'
}
</script>

<template>
  <button
    class="button"
    :aria-label="locale === 'en' ? '中' : 'En'"
    :title="locale === 'en' ? '中' : 'En'"
    @click="toggle"
  >
    <IconLocaleZh v-if="locale === 'en'" :size="22" no-circle />
    <IconLocaleEn v-else :size="22" no-circle />
  </button>
</template>
