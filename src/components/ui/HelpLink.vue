<script setup lang="ts">
import IconHelpSmall from '@/components/ui/IconHelpSmall.vue'
import { helpPath, type HelpSection } from '@/lib/help'
import { useI18nStore } from '@/stores/i18n'

defineProps<{ section: HelpSection }>()

const i18n = useI18nStore()
</script>

<template>
  <RouterLink
    class="help-link"
    :to="helpPath(i18n.currentLocale, section)"
    :title="i18n.t('app.help')"
    :aria-label="i18n.t('app.help')"
  >
    <IconHelpSmall aria-hidden="true" />
  </RouterLink>
</template>

<style scoped>
.help-link {
  display: inline-flex;
  flex-shrink: 0;
  color: var(--color-text-secondary);
  opacity: var(--help-mark-opacity);
  transition: all var(--transition-fast);
}

.help-link:hover,
.help-link:focus-visible {
  opacity: 1;
  color: var(--color-primary);
}
</style>
