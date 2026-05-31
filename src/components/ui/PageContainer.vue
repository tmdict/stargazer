<script setup lang="ts">
import IconClose from './IconClose.vue'

import '@/styles/modal.css'
import '@/styles/content.css'

interface Props {
  maxWidth?: string
  // Anchor to viewport top instead of centering. Use when content height can
  // change at runtime so the top edge stays put.
  topAnchor?: boolean
}

withDefaults(defineProps<Props>(), {
  maxWidth: '800px',
  topAnchor: false,
})
</script>

<template>
  <div class="overlay" :class="{ 'is-top-anchored': topAnchor }">
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
