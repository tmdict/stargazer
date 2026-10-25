<script setup lang="ts">
import ConfirmLabel from '@/components/ui/ConfirmLabel.vue'
import { useI18nStore } from '@/stores/i18n'

defineProps<{ armed: boolean }>()
const emit = defineEmits<{ reset: [] }>()

const i18n = useI18nStore()
</script>

<template>
  <p class="learned-line">
    <button
      type="button"
      class="link-btn"
      :class="{ armed }"
      :title="i18n.t('app.import-forget-learned-tip')"
      @click="emit('reset')"
    >
      <ConfirmLabel :armed :label="i18n.t('app.import-forget-learned')" />
    </button>
  </p>
</template>
