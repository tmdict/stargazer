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
    fill-rule="evenodd"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 2l8 3v6c0 5.3-3.4 9.4-8 11-4.6-1.6-8-5.7-8-11V5l8-3zm0 5l1.3 3.2 3.2 1.3-3.2 1.3L12 16l-1.3-3.2-3.2-1.3 3.2-1.3L12 7z"
    />
  </svg>
</template>
