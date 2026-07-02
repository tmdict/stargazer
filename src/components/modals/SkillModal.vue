<script setup lang="ts">
import { computed, provide } from 'vue'

import BaseModal from './BaseModal.vue'
import SkillSections from '@/components/skill/SkillSections.vue'
import SkillLocaleMenu from '@/components/ui/SkillLocaleMenu.vue'
import { useModalSkillLocale } from '@/composables/useModalSkillLocale'
import { ContentInModalKey } from '@/utils/contentMeta'
import { hasSkillLocale } from '@/utils/dataLoader'

interface Props {
  show: boolean
  skillName: string
  initialChip?: string | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
}>()

// Tell descendant content components they're embedded: suppresses page-level meta writes
provide(ContentInModalKey, true)

// Modal-local skill-text locale, seeded from the saved preference; `applied`
// gates rendering on the locale chunk being warm. The permalink follows
// `selected` (the user's choice, warm or not); the target page handles its
// own loading.
const { selected, applied, apply } = useModalSkillLocale(() => props.show)

const hasLocaleData = computed(() => hasSkillLocale(props.skillName))
</script>

<template>
  <BaseModal
    :show="show"
    :link-param="skillName"
    :locale-override="selected"
    max-width="960px"
    :top-anchor="true"
    @close="emit('close')"
  >
    <template #header-buttons>
      <SkillLocaleMenu mode="select" :current="selected" @select="apply" />
    </template>
    <SkillSections
      v-if="hasLocaleData && applied"
      :slug="skillName"
      :lang="applied"
      :initial-chip="initialChip"
    />
    <div v-else-if="!hasLocaleData">Content not found for skill: {{ skillName }}</div>
  </BaseModal>
</template>
