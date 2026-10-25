<script setup lang="ts">
import { computed } from 'vue'

import BaseModal from './BaseModal.vue'
import SkillSection from '@/components/skill/SkillSection.vue'
import SkillLocaleMenu from '@/components/ui/SkillLocaleMenu.vue'
import { useModalSkillLocale } from '@/composables/useModalSkillLocale'
import type { PhantimalType } from '@/lib/types/phantimal'
import { useI18nStore } from '@/stores/i18n'
import { getSkillLanguage } from '@/utils/dataLoader'
import { phantimalDisplayName } from '@/utils/nameFormatting'
import { gameLabel } from '@/utils/skillLabels'

interface Props {
  show: boolean
  phantimal: PhantimalType
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
}>()

const i18n = useI18nStore()

// The name and skill text follow the skill-text language, as in the skill
// modal; the faction chip is chrome, in the site language.
const { selected, applied, failed, apply } = useModalSkillLocale(() => props.show)

const text = computed(() =>
  applied.value ? getSkillLanguage(applied.value)?.phantimals[props.phantimal.name] : undefined,
)

const title = computed(
  () => text.value?.name || phantimalDisplayName(i18n.currentLocale, props.phantimal.name),
)

// Each phantimal skill renders as its own SkillSection (heading = skill name),
// exactly like a character's skill slots.
const skills = computed(() =>
  (text.value?.skills ?? []).map((skill) => ({
    heading: skill.name,
    levels: skill.levels.map((description, i) => ({ level: i + 1, description })),
  })),
)
</script>

<template>
  <BaseModal
    :show="show"
    :label="title"
    :locale-override="selected"
    max-width="var(--skill-popup-width)"
    @close="emit('close')"
  >
    <template #header-buttons>
      <SkillLocaleMenu mode="select" :current="selected" @select="apply" />
    </template>

    <h1 class="detail-title">{{ title }}</h1>
    <div class="meta-chips" :lang="i18n.currentLocale">
      <span class="meta-chip">{{ gameLabel(phantimal.faction, i18n.currentLocale) }}</span>
    </div>

    <template v-if="applied || failed">
      <SkillSection
        v-for="(skill, i) in skills"
        :key="i"
        :heading="skill.heading"
        :levels="skill.levels"
      />
      <!-- A season can ship before the upstream feed carries its text. -->
      <p v-if="!skills.length" class="details-pending" :lang="i18n.currentLocale">
        {{ i18n.t(failed ? 'app.skill-load-failed' : 'app.skill-details-pending') }}
      </p>
    </template>
  </BaseModal>
</template>

<style scoped>
.details-pending {
  margin: 16px 0 0;
  color: rgba(255, 255, 255, 0.55);
  font-style: italic;
}
</style>
