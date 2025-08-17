<script setup lang="ts">
import '@/styles/modal.css'
import { useI18nStore } from '@/stores/i18n'
import IconClose from './IconClose.vue'

interface Props {
  maxWidth?: string
}

withDefaults(defineProps<Props>(), {
  maxWidth: '800px',
})

const i18n = useI18nStore()

// Only initialize on client - during SSG, use defaults
if (!import.meta.env.SSR) {
  i18n.initialize()
}
</script>

<template>
  <div class="overlay">
    <!-- Backdrop link to home -->
    <a href="/" class="backdrop-link" :aria-label="i18n.t('app.home')"></a>

    <!-- Content container (stops event propagation) -->
    <div class="container" :style="{ maxWidth }" @click.stop>
      <div class="buttons">
        <a href="/" class="button" :aria-label="i18n.t('app.home')" :title="i18n.t('app.home')">
          <IconClose />
        </a>
      </div>

      <div class="content">
        <slot />
      </div>
    </div>
  </div>
</template>
