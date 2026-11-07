<script setup lang="ts">
/* The Arena and Teams Generate button in its own look, set in running text. */

import IconSparkle from '@/components/ui/IconSparkle.vue'
</script>

<template>
  <span class="control-btn generate-btn help-generate-btn"
    ><IconSparkle :size="24" class="generate-sparkle"
  /></span>
</template>

<style scoped>
.help-generate-btn {
  vertical-align: middle;
  margin-block: -4px;
  min-height: 0;
  padding: 0 4px;
  border-width: 1px;
  pointer-events: none;
}
</style>
