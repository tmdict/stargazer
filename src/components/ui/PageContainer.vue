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

// Initialize i18n if not already initialized
i18n.initialize()
</script>

<template>
  <div class="overlay">
    <div class="container" :style="{ maxWidth }">
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
