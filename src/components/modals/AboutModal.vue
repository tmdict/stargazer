<script setup lang="ts">
import BaseModal from './BaseModal.vue'
import { useContentComponent } from '@/composables/useContentComponent'

interface Props {
  show: boolean
}

defineProps<Props>()
defineEmits<{
  close: []
}>()

const { ContentComponent } = useContentComponent({
  type: 'about',
  name: 'About',
})
</script>

<template>
  <BaseModal :show="show" maxWidth="1000px" linkParam="about" @close="$emit('close')">
    <component v-if="ContentComponent" :is="ContentComponent" />
    <div v-else>Content not found</div>
  </BaseModal>
</template>
