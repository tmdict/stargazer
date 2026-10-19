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
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M11.3 16.8C4.8 16 1.6 10.3 4.6 2c1 5.8 3.5 9.3 7.2 10.6z" />
    <path d="M12.7 16.8c6.5-.8 9.7-6.5 6.7-14.8-1 5.8-3.5 9.3-7.2 10.6z" />
    <path d="M12 7.5l2.6 5.2L12 22l-2.6-9.3z" />
  </svg>
</template>
