<script setup lang="ts">
import { computed } from 'vue'

import BaseModal from './BaseModal.vue'
import SkillSection from '@/components/skill/SkillSection.vue'
import ModalLocaleToggle from '@/components/ui/ModalLocaleToggle.vue'
import { useModalLocale } from '@/composables/useModalLocale'
import type { PhantimalType } from '@/lib/types/phantimal'
import { loadAppLocales, loadGameLocales, loadPhantimalLocales } from '@/utils/dataLoader'
import { formatDisplayName } from '@/utils/nameFormatting'

interface Props {
  show: boolean
  phantimal: PhantimalType
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
}>()

// Modal-local locale: overrides global without mutating it
const displayLocale = useModalLocale(() => props.show)

const gameLabel = (key: string) => loadGameLocales()[key]?.[displayLocale.value] ?? key

const locale = computed(() => loadPhantimalLocales()[props.phantimal.name])

const title = computed(
  () => locale.value?.name[displayLocale.value] || formatDisplayName(props.phantimal.name),
)

// Each phantimal skill renders as its own SkillSection (heading = skill name),
// exactly like a character's skill slots.
const skills = computed(() =>
  (locale.value?.skills ?? []).map((skill) => ({
    heading: skill.name[displayLocale.value],
    levels: skill.levels.map((lv, i) => ({ level: i + 1, description: lv[displayLocale.value] })),
  })),
)

// A season can ship before the upstream feed carries its text.
const pendingLabel = computed(
  () => loadAppLocales()['skill-details-pending']?.[displayLocale.value] ?? '',
)
</script>

<template>
  <BaseModal :show="show" :label="title" max-width="960px" @close="emit('close')">
    <template #header-buttons>
      <ModalLocaleToggle v-model="displayLocale" />
    </template>

    <h1>{{ title }}</h1>
    <div class="phantimal-meta">
      <span class="meta-chip">{{ gameLabel(phantimal.faction) }}</span>
    </div>

    <SkillSection
      v-for="(skill, i) in skills"
      :key="i"
      :heading="skill.heading"
      :levels="skill.levels"
    />
    <p v-if="!skills.length" class="details-pending">{{ pendingLabel }}</p>
  </BaseModal>
</template>

<style scoped>
.phantimal-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0 0 4px;
}

.details-pending {
  margin: 16px 0 0;
  color: rgba(255, 255, 255, 0.55);
  font-style: italic;
}
</style>
