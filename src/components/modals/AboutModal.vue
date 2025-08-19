<script setup lang="ts">
import BaseModal from './BaseModal.vue'
import { useContentComponent } from '@/composables/useContentComponent'
import { useI18nStore } from '@/stores/i18n'

interface Props {
  show: boolean
}

defineProps<Props>()
defineEmits<{
  close: []
}>()

const i18n = useI18nStore()

const { ContentComponent } = useContentComponent({
  type: 'about',
  name: 'About',
  locale: i18n.currentLocale,
})
</script>

<template>
  <BaseModal :show="show" maxWidth="1000px" linkParam="about" @close="$emit('close')">
    <component v-if="ContentComponent" :is="ContentComponent" />
    <div v-else>Content not found</div>
  </BaseModal>
</template>
