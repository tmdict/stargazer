<script setup lang="ts">
import { computed, ref } from 'vue'

import BaseModal from './BaseModal.vue'
import SkillKeywordTooltip from '@/components/skill/SkillKeywordTooltip.vue'
import SkillSection from '@/components/skill/SkillSection.vue'
import SkillLocaleMenu from '@/components/ui/SkillLocaleMenu.vue'
import { useModalDuelText } from '@/composables/useDuelText'
import { useModalSkillLocale } from '@/composables/useModalSkillLocale'
import type { CharacterType } from '@/lib/types/character'
import { useI18nStore } from '@/stores/i18n'
import { characterDisplayName } from '@/utils/nameFormatting'
import { gameLabel } from '@/utils/skillLabels'
import { getSkillLanguage } from '@/utils/skillLocale'

const props = defineProps<{
  show: boolean
  creature: CharacterType
}>()
const emit = defineEmits<{
  close: []
}>()

const i18n = useI18nStore()

// The name and skill text follow the skill-text language, as in the skill
// modal; the faction chip is chrome, in the site language.
const { selected, applied, failed: localeFailed, apply } = useModalSkillLocale(() => props.show)
const { loaded, failed: textFailed } = useModalDuelText(() => props.show, applied)
const failed = computed(() => localeFailed.value || textFailed.value)

const text = computed(() => loaded.value?.text?.creatures[props.creature.name])

const title = computed(() => text.value?.name || characterDisplayName(i18n.t, props.creature))

// A creature's skill has one level.
const skills = computed(() =>
  (text.value?.skills ?? []).map((skill) => ({
    heading: skill.name,
    levels: [{ level: 1, description: skill.description }],
  })),
)

// The glossary of the text's own language: during a switch the text still
// shown is the previous language's.
const glossary = computed(() =>
  loaded.value ? getSkillLanguage(loaded.value.lang)?.glossary : undefined,
)
const skillsEl = ref<HTMLElement | null>(null)

const settled = computed(() => failed.value || loaded.value !== null)
</script>

<template>
  <BaseModal :show :label="title" :locale-override="selected" @close="emit('close')">
    <template #header-buttons>
      <SkillLocaleMenu mode="select" :current="selected" @select="apply" />
    </template>

    <template #default>
      <h1 class="detail-title">{{ title }}</h1>
      <div class="meta-chips" :lang="i18n.currentLocale">
        <span class="meta-chip">{{ gameLabel(creature.faction, i18n.currentLocale) }}</span>
      </div>

      <template v-if="settled">
        <div v-if="skills.length" ref="skillsEl">
          <SkillSection
            v-for="(skill, i) in skills"
            :key="i"
            :heading="skill.heading"
            :levels="skill.levels"
          />
          <SkillKeywordTooltip
            v-if="loaded && glossary"
            :lang="loaded.lang"
            :glossary
            :container="skillsEl"
          />
        </div>
        <p v-else class="details-pending" :lang="i18n.currentLocale">
          {{ i18n.t(failed ? 'app.skill-load-failed' : 'app.skill-details-pending') }}
        </p>
      </template>
    </template>
  </BaseModal>
</template>
