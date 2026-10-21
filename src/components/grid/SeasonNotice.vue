<script setup lang="ts">
/* Banner naming the season whose retired content was just stripped from the
 * live boards. Persistent and dismissible, unlike a toast: a strip usually
 * happens during a quiet restore (first visit after a cutover), and an
 * auto-expiring message would vanish before the missing pieces are noticed. */

import IconInfo from '@/components/ui/IconInfo.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import { useSeasonNotice } from '@/composables/useSeasonNotice'
import { useI18nStore } from '@/stores/i18n'

const i18n = useI18nStore()
const { season, dismiss } = useSeasonNotice()
</script>

<template>
  <NoticeBanner
    v-if="season !== null"
    :icon="IconInfo"
    :message="i18n.t('app.seasonal-removed', { n: season })"
    role="status"
    @dismiss="dismiss"
  />
</template>
