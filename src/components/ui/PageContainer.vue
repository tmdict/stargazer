<script setup lang="ts">
import IconClose from './IconClose.vue'

import '@/styles/modal.css'

interface Props {
  maxWidth?: string
}

withDefaults(defineProps<Props>(), {
  maxWidth: '800px',
})
</script>

<template>
  <div class="overlay">
    <!-- Backdrop link to home -->
    <a href="/" class="backdrop-link" aria-label="Stargazer"></a>

    <!-- Content container (stops event propagation) -->
    <div class="container" :style="{ maxWidth }" @click.stop>
      <div class="buttons">
        <a href="/" class="button" aria-label="Stargazer" title="Stargazer">
          <IconClose />
        </a>
      </div>

      <div class="content">
        <slot />
      </div>
    </div>
  </div>
</template>
