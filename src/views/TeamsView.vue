<script setup lang="ts">
import { useHead } from '@unhead/vue'

import ImageStitcher from '@/components/teams/ImageStitcher.vue'
import TabView from '@/components/ui/TabView.vue'
import ToastContainer from '@/components/ui/ToastContainer.vue'

useHead({ title: 'Teams · Stargazer' })
</script>

<template>
  <main>
    <section class="section">
      <TabView>
        <template #default>
          <h1 class="page-title">Image Stitcher</h1>
          <ImageStitcher />
        </template>
      </TabView>
    </section>
    <ToastContainer />
  </main>
</template>

<style scoped>
.page-title {
  margin: 0 0 var(--spacing-lg);
  font-size: 1.3rem;
  font-weight: 600;
  color: var(--color-text-primary);
}
</style>
