<script setup lang="ts">
/* The top bar's help menu: the site's About, Help, source code and Contact. */

import DropdownRow from './DropdownRow.vue'
import DropdownSelect from './DropdownSelect.vue'
import IconBook from './IconBook.vue'
import IconGitHub from './IconGitHub.vue'
import IconHelp from './IconHelp.vue'
import IconInfo from './IconInfo.vue'
import IconMail from './IconMail.vue'
import { opensElsewhere } from '@/composables/useDropdown'
import { helpPath } from '@/lib/help'
import { useI18nStore } from '@/stores/i18n'

const emit = defineEmits<{ about: []; contact: [] }>()

const i18n = useI18nStore()

const ROW_ICON_SIZE = 16

const follow = (e: MouseEvent, close: () => void): void => {
  if (!opensElsewhere(e)) close()
}

const openAbout = (close: () => void): void => {
  close()
  emit('about')
}

const openContact = (close: () => void): void => {
  close()
  emit('contact')
}
</script>

<template>
  <DropdownSelect variant="icon" :label="i18n.t('app.help-info')" :title="i18n.t('app.help-info')">
    <template #icon>
      <IconHelp aria-hidden="true" />
    </template>
    <template #default="{ close }">
      <DropdownRow :label="i18n.t('app.about')" @click="openAbout(close)">
        <template #icon><IconInfo :size="ROW_ICON_SIZE" aria-hidden="true" /></template>
      </DropdownRow>
      <DropdownRow
        :label="i18n.t('app.help')"
        :to="helpPath(i18n.currentLocale)"
        @click="follow($event, close)"
      >
        <template #icon><IconBook :size="ROW_ICON_SIZE" aria-hidden="true" /></template>
      </DropdownRow>
      <DropdownRow
        :label="i18n.t('app.source-code')"
        href="https://github.com/tmdict/stargazer/"
        @click="follow($event, close)"
      >
        <template #icon><IconGitHub :size="ROW_ICON_SIZE" aria-hidden="true" /></template>
      </DropdownRow>
      <DropdownRow :label="i18n.t('app.contact')" @click="openContact(close)">
        <template #icon><IconMail :size="ROW_ICON_SIZE" aria-hidden="true" /></template>
      </DropdownRow>
    </template>
  </DropdownSelect>
</template>
