<script setup lang="ts">
import PageContainer from '@/components/ui/PageContainer.vue'
import { useContentComponent } from '@/composables/useContentComponent'
import { useRouteLocale } from '@/composables/useRouteLocale'

const locale = useRouteLocale()

const { ContentComponent } = useContentComponent({
  type: 'page',
  name: 'About',
  locale,
})
</script>

<template>
  <PageContainer maxWidth="1000px">
    <component v-if="ContentComponent" :is="ContentComponent" />
    <div v-else>Content not found</div>
  </PageContainer>
</template>
