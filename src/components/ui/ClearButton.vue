<script setup lang="ts">
import IconTrash from './IconTrash.vue'
import { useArmedConfirm } from '@/composables/useArmedConfirm'
import { useI18nStore } from '@/stores/i18n'

const { confirmFirst = false } = defineProps<{
  // Two-step confirm before firing (the Teams page; the Arena clears instantly).
  confirmFirst?: boolean
}>()

const emit = defineEmits<{
  click: []
}>()

const i18n = useI18nStore()
const { armed, confirm } = useArmedConfirm()

const handleClick = (): void => {
  if (confirmFirst && !confirm('clear')) return
  emit('click')
}
</script>

<template>
  <button
    @click="handleClick"
    class="control-btn danger clear-all-btn"
    :class="{ armed: armed !== null }"
    :title="i18n.t(armed !== null ? 'app.confirm' : 'app.clear')"
  >
    <IconTrash :size="14" class="btn-icon" />
    <span class="btn-text">{{ i18n.t(armed !== null ? 'app.confirm' : 'app.clear') }}</span>
  </button>
</template>

<style scoped>
/* Desktop-only side margin so Clear reads as slightly apart from the share
   actions; on mobile spacing comes purely from the row's flex gap. */
.clear-all-btn {
  margin: 0 5px;
}

@media (max-width: 768px) {
  .clear-all-btn {
    margin: 0;
  }
}
</style>
