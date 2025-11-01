<script setup lang="ts">
import { onMounted, ref } from 'vue'

const content = ref<HTMLElement>()

/**
 * Highlights text enclosed in [[brackets]] with a styled span
 * @param text - Text containing [[highlighted]] sections
 * @returns HTML string with highlighted spans
 */
const highlight = (text: string): string =>
  text.replace(/\[\[(.+?)\]\]/g, '<span class="skill-highlight">$1</span>')

onMounted(() => {
  if (content.value) {
    // Get the original HTML content
    const originalHTML = content.value.innerHTML
    // Apply highlighting transformation
    content.value.innerHTML = highlight(originalHTML)
  }
})
</script>

<template>
  <div ref="content">
    <slot />
  </div>
</template>
