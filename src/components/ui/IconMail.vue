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
    <!-- Envelope knocked out of a filled circle via mask, matching the other
         circular menu icons (IconInfo, IconLocaleEn/Zh). -->
    <defs>
      <mask id="mail-mask">
        <rect x="0" y="0" width="24" height="24" fill="white" />
        <path
          fill="black"
          transform="translate(4.8 4.8) scale(0.6)"
          d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"
        />
      </mask>
    </defs>
    <circle cx="12" cy="12" r="10" mask="url(#mail-mask)" />
  </svg>
</template>
