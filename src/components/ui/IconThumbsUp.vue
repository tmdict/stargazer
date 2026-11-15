<script setup lang="ts">
const { size = 24 } = defineProps<{ size?: number }>()
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path
      d="M2 10h4v11H2zM8 21h9.3a2 2 0 0 0 1.9-1.4l2.2-7A2 2 0 0 0 19.5 10H14l.7-4.2A2.4 2.4 0 0 0 12.3 3L8 9.5z"
    />
  </svg>
</template>
