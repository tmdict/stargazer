<script setup lang="ts">
/* The site-language menu: the current language's glyph opens the list of
   APP_LOCALES, each named in itself. The header's switches the site; a
   modal's (`inModal`, drawn as one of its `.button`s) switches only what
   that modal shows. */

import { computed } from 'vue'

import DropdownSelect, { type DropdownItem } from './DropdownSelect.vue'
import IconLocale from './IconLocale.vue'
import { APP_LOCALES, isAppLocale, localeNativeName, type AppLocale } from '@/lib/types/i18n'
import { useI18nStore } from '@/stores/i18n'

const {
  current,
  inModal = false,
  linkTo,
} = defineProps<{
  current: AppLocale
  inModal?: boolean
  // Where a language's row leads, on a page whose address carries the language.
  linkTo?: (locale: AppLocale) => string | undefined
}>()

const emit = defineEmits<{ select: [locale: AppLocale] }>()

const i18n = useI18nStore()

const items = computed<DropdownItem[]>(() =>
  APP_LOCALES.map((code) => ({
    key: code,
    label: localeNativeName(code),
    selected: code === current,
    to: linkTo?.(code),
  })),
)

const select = (key: string): void => {
  if (isAppLocale(key)) emit('select', key)
}
</script>

<template>
  <DropdownSelect
    variant="icon"
    :label="i18n.t('app.language')"
    :title="i18n.t('app.language')"
    :items
    :trigger-class="inModal ? 'button' : undefined"
    @select="select"
  >
    <template #icon>
      <IconLocale
        :locale="current"
        :size="inModal ? 22 : 24"
        :no-circle="inModal"
        aria-hidden="true"
      />
    </template>
  </DropdownSelect>
</template>
