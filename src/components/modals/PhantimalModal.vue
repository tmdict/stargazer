<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import BaseModal from './BaseModal.vue'
import SkillSection from '@/components/skill/SkillSection.vue'
import ModalLocaleToggle from '@/components/ui/ModalLocaleToggle.vue'
import type { PhantimalType } from '@/lib/types/phantimal'
import { useI18nStore } from '@/stores/i18n'
import { loadGameLocales, loadPhantimalLocales } from '@/utils/dataLoader'
import { formatDisplayName } from '@/utils/nameFormatting'

interface Props {
  show: boolean
  phantimal: PhantimalType
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
}>()

const i18n = useI18nStore()

// Modal-local locale toggle, mirroring SkillModal/ArtifactModal.
const displayLocale = ref<'en' | 'zh'>(i18n.currentLocale)
watch(
  () => props.show,
  (isOpen) => {
    if (isOpen) displayLocale.value = i18n.currentLocale
  },
)

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
</script>

<template>
  <BaseModal :show="show" max-width="960px" @close="emit('close')">
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
  </BaseModal>
</template>

<style scoped>
.phantimal-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0 0 4px;
}

.meta-chip {
  padding: 2px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.85);
  font-size: 13px;
  line-height: 1.6;
}
</style>
