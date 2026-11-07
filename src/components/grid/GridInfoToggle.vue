<script setup lang="ts">
/* The Grid Info control. State lives in the shared device pref
   (useGridInfoPrefs); enable cascades run there, so a tap on a nested child also
   lights its parents. */

import { computed } from 'vue'

import ToggleChipMenu from '@/components/ui/ToggleChipMenu.vue'
import { gridInfoMenuRows, useGridInfoPrefs } from '@/composables/useGridInfoPrefs'
import { useI18nStore } from '@/stores/i18n'

const { share = false } = defineProps<{
  // ShareView presentation: right-aligned, checklist everywhere.
  share?: boolean
}>()

const i18n = useI18nStore()
const { prefs, setPref } = useGridInfoPrefs()

const groups = computed(() => [{ rows: gridInfoMenuRows(prefs, (key) => i18n.t(`app.${key}`)) }])

const master = computed({
  get: () => prefs.master,
  set: (on: boolean) => setPref('master', on),
})
</script>

<template>
  <ToggleChipMenu
    v-model="master"
    :label="i18n.t('app.grid-info')"
    :options-label="i18n.t('app.grid-info-options')"
    :groups
    :share
    @toggle="(key) => setPref(key, !prefs[key])"
  />
</template>
