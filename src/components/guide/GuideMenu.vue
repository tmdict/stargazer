<script setup lang="ts">
/* The top bar's Guide tab: the owner's link to the guide index, with a list
   of each guide page that opens on mouse hover. Touch screens keep the plain
   link. */

import { computed } from 'vue'
import { useRoute } from 'vue-router'

import DropdownSelect, { type DropdownItem } from '@/components/ui/DropdownSelect.vue'
import { PVP_SEASONS } from '@/content/pvp/seasons'
import { guidePath, SL_GENERATOR_PATH, WWW_PATH } from '@/lib/guide'
import { pvpReportHref } from '@/lib/pvp/summary'
import { useI18nStore } from '@/stores/i18n'
import { interpolate } from '@/utils/interpolate'

const i18n = useI18nStore()
const route = useRoute()

const page = (key: string, label: string, to: string, meta?: string): DropdownItem => ({
  key,
  label,
  meta,
  selected: route.name === key,
  to,
})

const items = computed<DropdownItem[]>(() => [
  page('guide-sl', i18n.t('app.sl-title'), SL_GENERATOR_PATH, 'BETA'),
  page('guide-www', i18n.t('app.www-title'), WWW_PATH, 'BETA'),
  ...PVP_SEASONS.map(({ season, live }) => ({
    key: `report-${season}`,
    label: `${interpolate(i18n.t('app.season'), { n: season })} ${i18n.t('app.pvp-report')}`,
    meta: live ? i18n.t('app.current-season') : undefined,
    selected: false,
    href: pvpReportHref(season, i18n.currentLocale),
  })),
  page('guide-upgrades', i18n.t('app.upgrades'), guidePath('upgrades')),
  page('guide-mechanics', i18n.t('app.mechanics'), guidePath('mechanics')),
])
</script>

<template>
  <DropdownSelect variant="nav" :label="i18n.t('app.guide')" :items>
    <template #trigger>
      <slot />
    </template>
  </DropdownSelect>
</template>
