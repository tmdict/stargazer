<script setup lang="ts">
import PageContainer from '@/components/ui/PageContainer.vue'
import { useContentComponent } from '@/composables/useContentComponent'

// No props or SSG-specific code needed
// useContentComponent reads locale from i18n store automatically
const { ContentComponent } = useContentComponent({
  type: 'about',
  name: 'About',
})
</script>

<template>
  <PageContainer maxWidth="1000px">
    <component v-if="ContentComponent" :is="ContentComponent" />
    <div v-else>Content not found</div>
  </PageContainer>
</template>
