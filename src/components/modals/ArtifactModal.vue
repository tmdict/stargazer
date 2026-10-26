<script setup lang="ts">
import { computed } from 'vue'

import BaseModal from './BaseModal.vue'
import SkillSection from '@/components/skill/SkillSection.vue'
import SkillLocaleMenu from '@/components/ui/SkillLocaleMenu.vue'
import { useModalSkillLocale } from '@/composables/useModalSkillLocale'
import type { ArtifactType } from '@/lib/types/artifact'
import { useI18nStore } from '@/stores/i18n'
import { formatArtifactStats } from '@/utils/artifactStats'
import { getSkillLanguage } from '@/utils/dataLoader'
import { localizedDisplayName } from '@/utils/nameFormatting'
import { gameLabel } from '@/utils/skillLabels'

interface Props {
  show: boolean
  artifact: ArtifactType
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
}>()

const i18n = useI18nStore()

// The name and effect text follow the skill-text language, as in the skill
// modal; the season and stat chips are chrome, in the site language.
const { selected, applied, failed, apply } = useModalSkillLocale(() => props.show)

const text = computed(() =>
  applied.value ? getSkillLanguage(applied.value)?.artifacts[props.artifact.name] : undefined,
)

const title = computed(
  () => text.value?.name || localizedDisplayName(i18n.t, 'artifact', props.artifact.name),
)

const stats = computed(() => formatArtifactStats(props.artifact.stats, i18n.currentLocale))

// Level 1 is the base effect, 2+ are upgrades.
const effectLevels = computed(() =>
  (text.value?.levels ?? []).map((description, i) => ({ level: i + 1, description })),
)
</script>

<template>
  <BaseModal
    :show="show"
    :label="title"
    :locale-override="selected"
    max-width="640px"
    @close="emit('close')"
  >
    <template #header-buttons>
      <SkillLocaleMenu mode="select" :current="selected" @select="apply" />
    </template>

    <h1 class="detail-title">{{ title }}</h1>
    <div class="artifact-stats meta-chips" :lang="i18n.currentLocale">
      <span class="meta-chip stat-chip">
        {{ gameLabel('season', i18n.currentLocale) }} {{ artifact.season }}
      </span>
      <span v-for="stat in stats" :key="stat.key" class="meta-chip stat-chip">
        {{ stat.label }} <strong>{{ stat.value }}</strong>
      </span>
    </div>

    <template v-if="applied || failed">
      <SkillSection v-if="effectLevels.length" :levels="effectLevels" />
      <!-- A season can ship before the upstream feed carries its text. -->
      <p v-else class="details-pending" :lang="i18n.currentLocale">
        {{ i18n.t(failed ? 'app.skill-load-failed' : 'app.skill-details-pending') }}
      </p>
    </template>
  </BaseModal>
</template>

<style scoped>
.artifact-stats {
  padding-bottom: 16px;
  border-bottom: 2px solid var(--color-border-primary);
}

/* Doubled class outweighs the shared `.content .meta-chip` rule. */
.meta-chip.stat-chip {
  color: rgba(255, 255, 255, 0.7);
}

.stat-chip strong {
  color: #fff;
  font-weight: 600;
}

.details-pending {
  margin: 16px 0 0;
  color: rgba(255, 255, 255, 0.55);
  font-style: italic;
}
</style>
