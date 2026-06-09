<script setup lang="ts">
import { useHead } from '@unhead/vue'

import ImageStitcher from '@/components/comps/ImageStitcher.vue'
import ToastContainer from '@/components/ui/ToastContainer.vue'

useHead({ title: 'Image Stitcher · Stargazer' })
</script>

<template>
  <main>
    <ImageStitcher />
    <ToastContainer />
  </main>
</template>
