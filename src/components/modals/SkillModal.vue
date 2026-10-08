<script setup lang="ts">
import { computed, provide } from 'vue'

import BaseModal from './BaseModal.vue'
import SkillSections from '@/components/skill/SkillSections.vue'
import SkillLocaleMenu from '@/components/ui/SkillLocaleMenu.vue'
import { useModalSkillLocale } from '@/composables/useModalSkillLocale'
import type { TagPick } from '@/lib/types/skill'
import { ContentInModalKey } from '@/utils/contentMeta'
import { hasSkillLocale } from '@/utils/dataLoader'
import { heroDisplayName } from '@/utils/skillLabels'

interface Props {
  show: boolean
  skillName: string
  initialChips?: readonly TagPick[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
}>()

// Tell descendant content components they're embedded: suppresses page-level meta writes
provide(ContentInModalKey, true)

// Modal-local skill-text locale, seeded from the saved preference; `applied`
// gates rendering on the locale chunk being warm, and `failed` lets the
// sections render their own could-not-load line. The permalink follows
// `selected` (the user's choice, warm or not); the target page handles its
// own loading.
const { selected, applied, failed, apply } = useModalSkillLocale(() => props.show)

const hasLocaleData = computed(() => hasSkillLocale(props.skillName))
const label = computed(() => heroDisplayName(props.skillName, selected.value))
</script>

<template>
  <BaseModal
    :show="show"
    :label
    :link-param="skillName"
    :locale-override="selected"
    max-width="var(--skill-popup-width)"
    :top-anchor="true"
    @close="emit('close')"
  >
    <template #header-buttons>
      <SkillLocaleMenu mode="select" :current="selected" @select="apply" />
    </template>
    <SkillSections
      v-if="hasLocaleData && (applied || failed)"
      :slug="skillName"
      :lang="applied ?? selected"
      :initial-chips
    />
    <div v-else-if="!hasLocaleData">Content not found for skill: {{ skillName }}</div>
  </BaseModal>
</template>
