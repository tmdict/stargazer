<script setup lang="ts">
import { computed, provide } from 'vue'

import BaseModal from './BaseModal.vue'
import SkillSections from '@/components/skill/SkillSections.vue'
import ModalLocaleToggle from '@/components/ui/ModalLocaleToggle.vue'
import { useModalLocale } from '@/composables/useModalLocale'
import { ContentInModalKey } from '@/utils/contentMeta'
import { loadSkillLocales } from '@/utils/dataLoader'

interface Props {
  show: boolean
  skillName: string
  initialChip?: string | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
}>()

// Tell descendant content components they're embedded — suppresses page-level meta writes
provide(ContentInModalKey, true)

// Modal-local locale: overrides global without mutating it
const displayLocale = useModalLocale(() => props.show)

const hasLocaleData = computed(() => !!loadSkillLocales()[displayLocale.value]?.[props.skillName])
</script>

<template>
  <BaseModal
    :show="show"
    :link-param="skillName"
    :locale-override="displayLocale"
    max-width="960px"
    :top-anchor="true"
    @close="emit('close')"
  >
    <template #header-buttons>
      <ModalLocaleToggle v-model="displayLocale" />
    </template>
    <SkillSections
      v-if="hasLocaleData"
      :slug="skillName"
      :lang="displayLocale"
      :initial-chip="initialChip"
    />
    <div v-else>Content not found for skill: {{ skillName }}</div>
  </BaseModal>
</template>
