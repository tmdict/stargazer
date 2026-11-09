<script setup lang="ts">
/* The first page's notice that the site moved. Its action opens the popup, or,
   once the old address only redirects, fetches the old data. That action is a
   button: opened in another tab, a link would leave without the marker that
   tells the new address the data was asked for. */

import IconInfo from '@/components/ui/IconInfo.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import { MOVE_STAGE } from '@/lib/move/config'
import { useI18nStore } from '@/stores/i18n'

const emit = defineEmits<{ details: []; bring: []; dismiss: [] }>()

const i18n = useI18nStore()
</script>

<template>
  <div class="move-banner">
    <NoticeBanner
      :icon="IconInfo"
      :message="i18n.t('app.move-banner')"
      role="status"
      @dismiss="emit('dismiss')"
    >
      <button v-if="MOVE_STAGE === 2" type="button" class="move-action" @click="emit('bring')">
        {{ i18n.t('app.move-bring') }}
      </button>
      <button type="button" class="move-action" @click="emit('details')">
        {{ i18n.t('app.move-details') }}
      </button>
    </NoticeBanner>
  </div>
</template>

<style scoped>
.move-banner {
  padding: var(--spacing-md) var(--spacing-lg) 0;
}

.move-banner :deep(.notice-banner) {
  flex-wrap: wrap;
  margin-bottom: 0;
}

.move-action {
  padding: 0;
  border: none;
  background: none;
  color: var(--color-primary);
  font: inherit;
  font-weight: 600;
  text-decoration: underline;
  cursor: pointer;
}

.move-action:hover {
  color: var(--color-primary-hover);
}
</style>
