<script setup lang="ts">
/* The top bar's help menu: the site's About, Help, source code and Contact. */

import { computed } from 'vue'

import DropdownSelect, { type DropdownItem } from './DropdownSelect.vue'
import IconHelp from './IconHelp.vue'
import { helpPath } from '@/lib/help'
import { useI18nStore } from '@/stores/i18n'

const emit = defineEmits<{ about: []; contact: [] }>()

const i18n = useI18nStore()

const items = computed<DropdownItem[]>(() => [
  { key: 'about', label: i18n.t('app.about'), selected: false },
  { key: 'help', label: i18n.t('app.help'), selected: false, to: helpPath(i18n.currentLocale) },
  {
    key: 'source-code',
    label: i18n.t('app.source-code'),
    selected: false,
    href: 'https://github.com/tmdict/stargazer/',
  },
  { key: 'contact', label: i18n.t('app.contact'), selected: false },
])

const select = (key: string): void => {
  if (key === 'about') emit('about')
  else if (key === 'contact') emit('contact')
}
</script>

<template>
  <DropdownSelect
    variant="icon"
    :label="i18n.t('app.help-info')"
    :title="i18n.t('app.help-info')"
    :items
    @select="select"
  >
    <template #icon>
      <IconHelp aria-hidden="true" />
    </template>
  </DropdownSelect>
</template>
