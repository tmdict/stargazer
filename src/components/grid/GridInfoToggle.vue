<script setup lang="ts">
/* The Grid Info control. State lives in the shared device pref
   (useGridInfoPrefs); enable cascades run there, so a tap on a nested child also
   lights its parents. A row whose surface is ineffective (master or a structural
   parent off) dims but keeps its remembered checked state. */

import { computed } from 'vue'

import ToggleChipMenu from '@/components/ui/ToggleChipMenu.vue'
import {
  GRID_INFO_PARENTS,
  useGridInfoPrefs,
  type GridInfoKey,
} from '@/composables/useGridInfoPrefs'
import { useI18nStore } from '@/stores/i18n'

const { share = false } = defineProps<{
  // ShareView presentation: right-aligned, checklist everywhere.
  share?: boolean
}>()

const i18n = useI18nStore()
const { prefs, setPref } = useGridInfoPrefs()

interface Row {
  key: GridInfoKey
  label: string
}

const rows: Row[] = [
  { key: 'tileIds', label: 'app.tile-ids' },
  { key: 'coordinates', label: 'app.coordinates' },
  { key: 'hover', label: 'app.details-on-hover' },
  { key: 'targeting', label: 'app.targeting' },
  { key: 'heroCard', label: 'app.hero-card' },
  { key: 'upgrades', label: 'app.upgrades' },
  { key: 'heroSkin', label: 'app.hero-skin' },
]

// Indentation and dimming derive from the shared parent map, so the checklist
// cannot drift from the cascade and derivation semantics.
const parentsOf = (key: GridInfoKey): GridInfoKey[] => GRID_INFO_PARENTS[key] ?? []
const isSub = (key: GridInfoKey): boolean => parentsOf(key).length > 0
const ghosted = (key: GridInfoKey): boolean =>
  !prefs.master || parentsOf(key).some((parent) => !prefs[parent])

const groups = computed(() => [
  {
    rows: rows.map(({ key, label }) => ({
      key,
      label: i18n.t(label),
      checked: prefs[key],
      sub: isSub(key),
      dim: ghosted(key),
    })),
  },
])

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
