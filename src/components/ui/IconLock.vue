<!-- A padlock, sized by the font size of the button it sits in; `open` draws
     the shackle lifted. -->
<script setup lang="ts">
defineProps<{ open?: boolean }>()
</script>

<template>
  <svg
    width="1em"
    height="1em"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path :d="open ? 'M8 11V7.5a4 4 0 0 1 7.6-1.7' : 'M8 11V7.5a4 4 0 0 1 8 0V11'" />
  </svg>
</template>
