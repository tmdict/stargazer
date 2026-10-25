<script setup lang="ts">
const { size = 24 } = defineProps<{
  size?: number
}>()
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <mask id="moon-mask">
        <rect x="0" y="0" width="24" height="24" fill="white" />
        <circle cx="16.5" cy="7.5" r="7.4" fill="black" />
      </mask>
    </defs>
    <circle cx="12" cy="12" r="9.5" mask="url(#moon-mask)" />
  </svg>
</template>
