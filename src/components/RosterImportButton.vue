<script setup lang="ts">
/* The roster screenshot import: opens the roster import modal (loaded
   on first use, so the page's chunk stays small) and saves the roster it hands
   back as a new one, which becomes the active roster. A save refused at the
   roster limit leaves the modal open with its review. Attributes go to the
   button, so RosterTransferActions' tooltip handlers reach it. */

import { defineAsyncComponent, ref } from 'vue'

import IconImagePlus from '@/components/ui/IconImagePlus.vue'
import { useRosterFeedback } from '@/composables/useRosterFeedback'
import { useToast } from '@/composables/useToast'
import type { AttrRecord } from '@/lib/characters/attributes'
import { useI18nStore } from '@/stores/i18n'
import { useRosters } from '@/stores/rosters'

defineOptions({ inheritAttrs: false })

const RosterImportModal = defineAsyncComponent(
  () => import('@/components/modals/RosterImportModal.vue'),
)

const rosters = useRosters()
const i18n = useI18nStore()
const { error } = useToast()
const { report } = useRosterFeedback()
const open = ref(false)
// Mounted on first use and kept, so the modal's leave transition plays.
const mounted = ref(false)

const openModal = (): void => {
  mounted.value = true
  open.value = true
}

const handleSave = (name: string, heroes: Record<string, AttrRecord>): void => {
  const created = rosters.create({ name, heroes })
  if (!created) {
    error(i18n.t('app.rosters-limit'))
    return
  }
  open.value = false
  report(
    i18n.t('app.roster-import-saved', {
      name: created.name,
      count: Object.keys(created.heroes).length,
    }),
  )
}
</script>

<template>
  <button type="button" class="control-btn compact" v-bind="$attrs" @click="openModal">
    <IconImagePlus :size="13" class="btn-icon" />
    <span class="btn-text">{{ i18n.t('app.roster-import-button') }}</span>
  </button>
  <RosterImportModal v-if="mounted" :show="open" @close="open = false" @save="handleSave" />
</template>
