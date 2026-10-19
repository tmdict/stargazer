<script setup lang="ts">
interface Props {
  size?: number
}

withDefaults(defineProps<Props>(), {
  size: 24,
})
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.6"
    stroke-linecap="round"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M15.4 15.1A5.3 5.3 0 1 1 19.1 11.4" />
    <path d="M10.2 13.8L4 20" />
    <circle cx="14" cy="10" r="1.7" fill="currentColor" stroke="none" />
  </svg>
</template>
