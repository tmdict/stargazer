<script setup lang="ts">
/* The Honor Duel board's map as the tab row's menu, `Honor Duel I` to `V`. */

import { computed } from 'vue'

import MapMenu from '@/components/grid/MapMenu.vue'
import { useDuelMapSlots } from '@/composables/useDuelMapSlots'
import { useI18nStore } from '@/stores/i18n'

const i18n = useI18nStore()
const { slots, held, select } = useDuelMapSlots()

const rowLabel = (name: string): string => `${i18n.t('app.honor-duel')} ${name}`

const maps = computed(() =>
  slots.map(({ key, name }) => ({ key, label: rowLabel(name), selected: key === held.value?.key })),
)
</script>

<template>
  <MapMenu :label="held ? rowLabel(held.name) : i18n.t('app.honor-duel')" :maps @select="select" />
</template>
