<script setup lang="ts">
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
    <!-- The mark is heavier than the ring, or it stops reading as a question
         mark at this size. -->
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke-width="1.75" />
      <path d="M8.91 8.47A3.2 3.2 0 1 1 14.9 10.65C14.4 12 12 12.3 12 14.6" stroke-width="2.4" />
      <path d="M12 18.2h.01" stroke-width="2.6" />
    </svg>
  </RouterLink>
</template>

<style scoped>
.help-link {
  display: inline-flex;
  flex-shrink: 0;
  color: var(--color-text-secondary);
  opacity: 0.55;
  transition: all var(--transition-fast);
}

.help-link:hover,
.help-link:focus-visible {
  opacity: 1;
  color: var(--color-primary);
}
</style>
