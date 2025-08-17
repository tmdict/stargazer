<script setup lang="ts">
import { toRef } from 'vue'
import BaseModal from './BaseModal.vue'
import { useContentComponent } from '@/composables/useContentComponent'

interface Props {
  show: boolean
  skillName: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
}>()

// Pass a reactive reference to skillName so the composable reacts to changes
const { ContentComponent } = useContentComponent({
  type: 'skill',
  name: toRef(props, 'skillName'),
})
</script>

<template>
  <BaseModal :show="show" :link-param="skillName" @close="emit('close')">
    <component v-if="ContentComponent" :is="ContentComponent" />
    <div v-else>Content not found for skill: {{ skillName }}</div>
  </BaseModal>
</template>
