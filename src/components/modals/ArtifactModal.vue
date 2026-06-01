<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import BaseModal from './BaseModal.vue'
import SkillSection from '@/components/skill/SkillSection.vue'
import ModalLocaleToggle from '@/components/ui/ModalLocaleToggle.vue'
import type { ArtifactType } from '@/lib/types/artifact'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import { formatArtifactStats } from '@/utils/artifactStats'
import { loadArtifactLocales, loadGameLocales } from '@/utils/dataLoader'
import { formatDisplayName } from '@/utils/nameFormatting'

interface Props {
  show: boolean
  artifact: ArtifactType
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
}>()

const gameDataStore = useGameDataStore()
const i18n = useI18nStore()

// Modal-local locale toggle, mirroring SkillModal. Resets to the global locale
// each time the modal opens.
const displayLocale = ref<'en' | 'zh'>(i18n.currentLocale)
watch(
  () => props.show,
  (isOpen) => {
    if (isOpen) displayLocale.value = i18n.currentLocale
  },
)

const gameLabel = (key: string) => loadGameLocales()[key]?.[displayLocale.value] ?? key

const title = computed(() => {
  const loc = loadArtifactLocales()[props.artifact.name]
  return loc?.[displayLocale.value] || formatDisplayName(props.artifact.name)
})

const stats = computed(() => formatArtifactStats(props.artifact.stats, displayLocale.value))

// Effect descriptions become a level ladder; SkillSection renders them with
// the same badges/highlighting/typography as character skills (level 1 is the
// base effect, 2+ are upgrades) — shared styling, no bespoke drift.
const effectLevels = computed(() =>
  gameDataStore.getArtifactEffects(props.artifact.name).map((effect, i) => ({
    level: i + 1,
    description: effect[displayLocale.value] || effect.en,
  })),
)
</script>

<template>
  <BaseModal :show="show" max-width="640px" @close="emit('close')">
    <template #header-buttons>
      <ModalLocaleToggle v-model="displayLocale" />
    </template>

    <h1>{{ title }}</h1>
    <div class="artifact-stats">
      <span class="stat-chip">{{ gameLabel('season') }} {{ artifact.season }}</span>
      <span v-for="stat in stats" :key="stat.key" class="stat-chip">
        {{ stat.label }} <strong>{{ stat.value }}</strong>
      </span>
    </div>

    <SkillSection :levels="effectLevels" />
  </BaseModal>
</template>

<style scoped>
/* Compact single-row info, like the skill modal's filter chips. The bottom
   border is the divider between the info and effects sections. */
.artifact-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0 0 4px;
  padding-bottom: 16px;
  border-bottom: 2px solid var(--color-border-primary);
}

.stat-chip {
  padding: 2px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
  line-height: 1.6;
}

.stat-chip strong {
  color: #fff;
  font-weight: 600;
}
</style>
