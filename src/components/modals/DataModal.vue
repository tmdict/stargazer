<script setup lang="ts">
/* The help menu's Data popup: where saved teams and rosters are kept, and each
   library's backup file, the same Export and Import the Teams page and the
   Rosters tab offer. */

import { computed, ref, watch } from 'vue'

import BaseModal from './BaseModal.vue'
import IconDownload from '@/components/ui/IconDownload.vue'
import IconUpload from '@/components/ui/IconUpload.vue'
import { useRostersTransfer, useTeamsTransfer } from '@/composables/useLibraryTransfer'
import { useI18nStore } from '@/stores/i18n'
import { useRosters } from '@/stores/rosters'
import { useTeamLibrary } from '@/stores/teamLibrary'

const { show } = defineProps<{ show: boolean }>()

const emit = defineEmits<{ close: [] }>()

type Transfer = ReturnType<typeof useTeamsTransfer>

const i18n = useI18nStore()
const library = useTeamLibrary()
const rosters = useRosters()
const teamsTransfer = useTeamsTransfer()
const rostersTransfer = useRostersTransfer({ activate: false })

// Export saves what storage holds, so each opening re-reads it: the counts
// then match the files in a tab that another tab has saved past.
watch(
  () => show,
  (open) => {
    if (!open) return
    library.refresh()
    rosters.refresh()
  },
  { immediate: true },
)

const cards = computed(() => [
  {
    key: 'teams',
    title: i18n.t('app.saved-teams'),
    count: i18n.t(library.count === 1 ? 'app.n-saved-team' : 'app.n-saved-teams', {
      n: library.count,
    }),
    note: i18n.t('app.data-teams-note'),
    exportFile: library.count > 0 ? () => teamsTransfer.download(library.exportTeams()) : null,
    transfer: teamsTransfer,
  },
  {
    key: 'rosters',
    title: i18n.t('app.rosters'),
    count: i18n.t(rosters.count === 1 ? 'app.n-roster' : 'app.n-rosters', { n: rosters.count }),
    note: i18n.t('app.data-rosters-note'),
    exportFile: rosters.count > 0 ? () => rostersTransfer.download(rosters.exportRosters()) : null,
    transfer: rostersTransfer,
  },
])

// One file picker serves both cards: Import notes which library the chosen
// file goes to.
const fileInput = ref<HTMLInputElement>()
let importing: Transfer | null = null

const chooseFile = (transfer: Transfer): void => {
  importing = transfer
  fileInput.value?.click()
}

const onFileChosen = (event: Event): void => {
  void importing?.handleFileChosen(event)
}
</script>

<template>
  <BaseModal :show :label="i18n.t('app.data')" @close="emit('close')">
    <h1>{{ i18n.t('app.data') }}</h1>
    <p>{{ i18n.t('app.data-storage') }}</p>
    <p class="reading-secondary">{{ i18n.t('app.data-safari') }}</p>

    <div class="data-cards">
      <section v-for="card in cards" :key="card.key" class="data-card">
        <h2>{{ card.title }}</h2>
        <p class="reading-meta">{{ card.count }}</p>
        <div class="data-actions">
          <button
            v-if="card.exportFile"
            type="button"
            class="solid-btn data-btn"
            @click="card.exportFile"
          >
            <IconDownload :size="14" aria-hidden="true" />
            {{ i18n.t('app.export') }}
          </button>
          <button type="button" class="glass-button data-btn" @click="chooseFile(card.transfer)">
            <IconUpload :size="14" aria-hidden="true" />
            {{ i18n.t('app.import') }}
          </button>
        </div>
        <p class="reading-meta">{{ card.note }}</p>
      </section>
    </div>

    <input
      ref="fileInput"
      type="file"
      accept="application/json,.json"
      class="file-input"
      @change="onFileChosen"
    />
  </BaseModal>
</template>

<style scoped>
.data-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(260px, 100%), 1fr));
  gap: 16px;
  margin-top: 20px;
}

.data-card {
  padding: 16px 20px;
  border: 1px solid var(--panel-dark-edge);
  border-radius: var(--radius-large);
  background: var(--reading-picture);
}

.data-card h2 {
  margin: 0;
  padding: 0;
  border-bottom: none;
}

.data-card p {
  margin: 2px 0 0;
}

.data-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  margin: 14px 0 10px;
}

.data-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: var(--control-height);
  padding: 0 var(--spacing-lg);
  font-size: var(--control-font-size);
  font-weight: var(--control-font-weight);
  cursor: pointer;
}

.file-input {
  display: none;
}
</style>
