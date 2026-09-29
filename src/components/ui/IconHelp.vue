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
    <!-- Stroke and dot sizes match IconInfo's. -->
    <defs>
      <mask id="help-mask">
        <rect x="0" y="0" width="24" height="24" fill="white" />
        <path
          d="M10.1 9.9a1.95 1.95 0 1 1 2.8 1.75c-.55.28-.9.72-.9 1.35v.9"
          fill="none"
          stroke="black"
          stroke-width="2"
        />
        <rect x="11" y="15" width="2" height="2" fill="black" />
      </mask>
    </defs>
    <circle cx="12" cy="12" r="10" mask="url(#help-mask)" />
  </svg>
</template>
