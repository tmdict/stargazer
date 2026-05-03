<script setup lang="ts">
import { computed, provide, ref, watch } from 'vue'

import BaseModal from './BaseModal.vue'
import IconLocaleEn from '@/components/ui/IconLocaleEn.vue'
import IconLocaleZh from '@/components/ui/IconLocaleZh.vue'
import { useContentComponent } from '@/composables/useContentComponent'
import { useI18nStore } from '@/stores/i18n'
import { ContentInModalKey } from '@/utils/contentMeta'

interface Props {
  show: boolean
  skillName: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
}>()

const i18n = useI18nStore()

// Tell descendant content components they're embedded — suppresses page-level meta writes
provide(ContentInModalKey, true)

// Modal-local locale: overrides global without mutating it. Resets every time the modal opens.
const displayLocale = ref<'en' | 'zh'>(i18n.currentLocale)

watch(
  () => props.show,
  (isOpen) => {
    if (isOpen) displayLocale.value = i18n.currentLocale
  },
)

const toggleLocale = () => {
  displayLocale.value = displayLocale.value === 'en' ? 'zh' : 'en'
}

const { ContentComponent } = useContentComponent({
  type: 'skill',
  name: computed(() => props.skillName),
  locale: displayLocale,
})
</script>

<template>
  <BaseModal
    :show="show"
    :link-param="skillName"
    :locale-override="displayLocale"
    @close="emit('close')"
  >
    <template #header-buttons>
      <button
        class="button"
        :aria-label="`Switch to ${displayLocale === 'en' ? 'Chinese' : 'English'}`"
        :title="displayLocale === 'en' ? 'Switch to Chinese' : 'Switch to English'"
        @click="toggleLocale"
      >
        <IconLocaleZh v-if="displayLocale === 'en'" :size="22" no-circle />
        <IconLocaleEn v-else :size="22" no-circle />
      </button>
    </template>
    <component v-if="ContentComponent" :is="ContentComponent" />
    <div v-else>Content not found for skill: {{ skillName }}</div>
  </BaseModal>
</template>
