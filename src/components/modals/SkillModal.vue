<script setup lang="ts">
import { computed } from 'vue'
import BaseModal from './BaseModal.vue'
import { useContentComponent } from '@/composables/useContentComponent'
import { useI18nStore } from '@/stores/i18n'

interface Props {
  show: boolean
  skillName: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
}>()

const i18n = useI18nStore()

// Pass a reactive reference to skillName so the composable reacts to changes
const { ContentComponent } = useContentComponent({
  type: 'skill',
  name: computed(() => props.skillName),
  locale: computed(() => i18n.currentLocale),
})
</script>

<template>
  <BaseModal :show="show" :link-param="skillName" @close="emit('close')">
    <component v-if="ContentComponent" :is="ContentComponent" />
    <div v-else>Content not found for skill: {{ skillName }}</div>
  </BaseModal>
</template>
