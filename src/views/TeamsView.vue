<script setup lang="ts">
import { ref } from 'vue'
import { useHead } from '@unhead/vue'

import ImageStitcher from '@/components/teams/ImageStitcher.vue'
import TabbedPanel from '@/components/ui/TabbedPanel.vue'
import ToastContainer from '@/components/ui/ToastContainer.vue'

useHead({ title: 'Teams · Stargazer' })

const activeTab = ref('stitcher')
const tabs = [{ key: 'stitcher', label: 'Image Stitcher' }]
</script>

<template>
  <main>
    <TabbedPanel v-model="activeTab" :tabs>
      <ImageStitcher v-if="activeTab === 'stitcher'" />
    </TabbedPanel>
    <ToastContainer />
  </main>
</template>
