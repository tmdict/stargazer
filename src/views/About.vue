<script setup lang="ts">
import PageContainer from '@/components/ui/PageContainer.vue'
import { useContentComponent } from '@/composables/useContentComponent'
import { useI18nStore } from '@/stores/i18n'

interface Props {
  locale?: string
}

const props = withDefaults(defineProps<Props>(), {
  locale: 'en',
})

// During SSG, set locale from route prop
const i18n = useI18nStore()
if (import.meta.env.SSR && props.locale) {
  i18n.setLocaleForSSG(props.locale as 'en' | 'zh')
}

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
