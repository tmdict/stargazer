<script setup lang="ts">
import IconLocaleEn from './IconLocaleEn.vue'
import IconLocaleZh from './IconLocaleZh.vue'
import { useI18nStore } from '@/stores/i18n'

const i18n = useI18nStore()
</script>

<template>
  <button
    @click="i18n.toggleLocale()"
    class="language-toggle"
    :aria-label="`Switch to ${i18n.currentLocale === 'en' ? 'Chinese' : 'English'}`"
  >
    <!-- Show Chinese icon when current locale is English (to switch to Chinese) -->
    <IconLocaleZh v-if="i18n.currentLocale === 'en'" :size="24" class="language-icon" />
    <!-- Show English icon when current locale is Chinese (to switch to English) -->
    <IconLocaleEn v-else :size="24" class="language-icon" />
  </button>
</template>

<style scoped>
.language-toggle {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text);
  transition:
    opacity 0.2s,
    transform 0.2s;
}

.language-toggle:hover {
  opacity: 0.8;
  transform: scale(1.1);
}

.language-toggle:active {
  transform: scale(0.95);
}

.language-icon {
  width: 24px;
  height: 24px;
}

/* Animation for smooth icon transition */
.language-icon {
  animation: fadeIn 0.2s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.8);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
