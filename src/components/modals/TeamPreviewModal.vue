<script setup lang="ts">
/* Enlarged read-only look at a saved team: the card's own TeamPreview at modal
   scale, no board loading. */

import BaseModal from './BaseModal.vue'
import TeamPreview from '@/components/teams/TeamPreview.vue'
import { TEAM_MODES } from '@/lib/teams/modes'
import type { SavedTeam } from '@/lib/teams/savedTeam'
import { useI18nStore } from '@/stores/i18n'

defineProps<{
  show: boolean
  team: SavedTeam
}>()

const emit = defineEmits<{
  close: []
}>()

const i18n = useI18nStore()
</script>

<template>
  <BaseModal :show="show" max-width="1000px" @close="emit('close')">
    <h1>{{ team.name }}</h1>
    <div class="team-meta">
      <span class="meta-chip">{{ i18n.t(TEAM_MODES[team.mode].labelKey) }}</span>
    </div>

    <TeamPreview :team large />
  </BaseModal>
</template>

<style scoped>
.team-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0 0 16px;
}
</style>
