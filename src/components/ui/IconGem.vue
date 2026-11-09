<script setup lang="ts">
const { size = 24 } = defineProps<{ size?: number }>()
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 24 24" fill="currentColor">
    <path d="M2 9l4-5h12l4 5-10 12z" opacity="0.55" />
    <path d="M9 9l3-5 3 5zM9 9h6l-3 12z" />
  </svg>
</template>
