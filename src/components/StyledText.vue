<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { highlightSkillText } from '@/utils/textHighlight'

const content = ref<HTMLElement>()

onMounted(() => {
  if (content.value) {
    content.value.innerHTML = highlightSkillText(content.value.innerHTML)
  }
})
</script>

<template>
  <div ref="content">
    <slot />
  </div>
</template>
